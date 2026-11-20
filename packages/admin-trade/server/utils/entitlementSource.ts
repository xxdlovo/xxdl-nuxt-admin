/**
 * entitlement 数据源（**覆盖**基座 `#admin/server/utils/entitlementSource` 的同名实现）。
 *
 * 基座只提供「空实现」，本层把它换成读会员等级库的真实实现：
 *   ctx.user → 会员档案 → 会员等级 → 功能目录 → 等级矩阵 → 目录默认值 → 管理员绕过 → 隐藏项
 *
 * 解析顺序（与返回值一一对应）：
 *   1. 无登录用户（`ctx.user` 缺失）→ `EMPTY_ENTITLEMENT_PROFILE`（features 为空，
 *      守卫对**任何**受控键都会拒绝）；
 *   2. 功能目录 = `sys_member_feature` 全部启用行（走 MemberFeatureCacheService 缓存）；
 *   3. 会员档案 = `sys_member`（memberRepo.findByUserId）；无档案 → 不查等级与矩阵，
 *      **全部功能取目录 `default_value`**，`levelId` / `levelName` 为 null
 *      ——「没有会员档案」不等于「没有任何能力」，否则所有受控功能都会误伤新用户；
 *   4. 等级 = `sys_member_level`（levelRepo.findById）；
 *      档案没有 levelId、或等级行已删除/不存在 → 同第 3 步走默认值；
 *   5. 等级矩阵 = `sys_member_level_feature`（按等级缓存），**显式配置优先**：
 *      `value = 矩阵行?.value ?? 目录 default_value`；
 *   6. 管理员绕过：`ctx.user.isAdmin === 1` 且该功能 `admin_bypass = 1` 时，
 *      开关置 1、配额置 `UNLIMITED`（-1）；`meta.adminBypass` 如实带上该标记
 *      （与基座守卫「meta.adminBypass !== false 才绕过」的口径一致）；
 *   7. 计量器键：`meta.resolverKey` 如实带上目录里的 `resolver_key`（可空）。
 *      基座 `assertEntitlement` 的配额分支用 `meta.resolverKey ?? 功能键` 查计量器，
 *      所以多个功能可以共用一个计量器（student.max / student.export 都按 studentCount 统计），
 *      漏填会让这类功能永远 403；
 *   8. 隐藏项：`user_show = 0` 的功能键收集进 `hiddenFeatures`
 *      （能力照常生效，但端用户侧不展示名称 / 额度 / 具体上限）。
 *
 *   合并规则本身在纯函数 `entitlementProfile.ts#buildEntitlementProfile`，本文件只负责取数，
 *   方便单独核对「目录 → 矩阵 → 默认值 → 管理员绕过 → 隐藏项」的口径。
 *
 * 覆盖机制：基座 `authMiddleware` / `AuthService` 用 Nitro server/utils **自动导入**调用
 * `resolveEntitlements`，按层优先级取到本文件；所以本文件**不要**被 trade 侧显式
 * `#admin/...` 导入使用，否则会绕过覆盖（本层内部一律从 `#trade` 引入）。
 *
 * 性能：目录与矩阵都走 30 分钟缓存（写入口主动失效）；同一请求的解析结果由基座
 * `authMiddleware` 一次性写入 `ctx.entitlements`，`assertEntitlement` /
 * `getEntitlement` / `myEntitlements` 都直接复用它，不会重复查库。
 */
import type { EntitlementProfile } from '#admin/shared/entitlement/types'
import { EMPTY_ENTITLEMENT_PROFILE } from '#admin/shared/entitlement/types'
import { useDb, type AppDb } from '#admin/server/drizzle/db'
import { memberRepo } from '#trade/server/trade-router/domain/member/repo/memberRepo'
import { levelRepo } from '#trade/server/trade-router/domain/member/repo/levelRepo'
import { memberFeatureCatalog } from '#trade/server/trade-router/modules/memberFeature/catalog'
import { memberLevelFeatureMatrix } from '#trade/server/trade-router/modules/memberLevel/matrix'
import { buildEntitlementProfile } from '#trade/server/utils/entitlementProfile'

/**
 * 同一 ctx 上的在飞解析去重。
 *
 * 基座在 `authMiddleware` 里 `await` 完本函数后会把结果写进 `ctx.entitlements`
 * （类型是 `EntitlementProfile | null`，不是 Promise），所以这里**不能**把 Promise
 * 塞进 `ctx.entitlements`；并发去重改用 WeakMap，只在解析期间存在，不污染 ctx。
 */
const inflightProfiles = new WeakMap<object, Promise<EntitlementProfile>>()

/**
 * 解析当前会话的能力画像。
 *
 * `ctx` 用 `any` 是为了与基座 `entitlementGuard` 的调用签名保持一致（守卫、数据源、
 * 自助接口三处传进来的都是 tRPC 的 Context，但基座不 import 本层的 Context 类型）。
 */
export async function resolveEntitlements(ctx: any): Promise<EntitlementProfile> {
  // 方法内部再取一次 id：`ctx.user` 是会话对象，不保证一定有 id
  const userId = typeof ctx?.user?.id === 'string' ? ctx.user.id : ''

  if (!userId) {
    return EMPTY_ENTITLEMENT_PROFILE
  }

  // 基座 authMiddleware 已经解析过（`auth.profile` 与守卫看到的是同一个对象），直接用
  const injected = ctx?.entitlements
  if (injected && typeof injected.then !== 'function') {
    return injected as EntitlementProfile
  }

  const cached = inflightProfiles.get(ctx)
  if (cached) {
    return await cached
  }

  const task = buildProfile(ctx, userId)
  inflightProfiles.set(ctx, task)

  try {
    return await task
  }
  finally {
    inflightProfiles.delete(ctx)
  }
}

async function buildProfile(ctx: any, userId: string): Promise<EntitlementProfile> {
  const db: AppDb = ctx.db ?? useDb()

  // 1) 功能目录（全局字典 + 缓存）。目录为空 = 尚未配置任何能力，
  //    此时 features 为空，守卫对任何受控键都会拒绝（DDL 未执行 / 功能全停用时的预期行为）。
  const catalog = await memberFeatureCatalog(ctx)

  if (catalog.length === 0) {
    return { levelId: null, levelName: null, features: {}, hiddenFeatures: [], meta: {} }
  }

  // 2) 会员档案 → 3) 会员等级（无档案 / 无等级都走默认值，不阻断能力解析）
  const member = await memberRepo(db).findByUserId(userId)
  const level = member?.levelId ? await levelRepo(db).findById(member.levelId) : null

  // 4) 等级矩阵：只有等级存在时才查（按等级缓存；未配置的键不在结果里）
  const matrix = level ? await memberLevelFeatureMatrix(ctx, level.id) : {}

  // 5) 合并目录 + 矩阵 + 默认值 + 管理员绕过 + 隐藏项（纯函数，见 entitlementProfile.ts）
  return buildEntitlementProfile({
    catalog,
    matrix,
    level: level ? { id: level.id, name: level.name } : null,
    isAdmin: Number(ctx.user?.isAdmin ?? 0) === 1
  })
}
