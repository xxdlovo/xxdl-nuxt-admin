/**
 * 能力（功能开关 / 配额）的**对外稳定入口**。
 *
 * 宿主应用 / 其它使用者从这里拿能力相关的所有能力，不必了解内部结构：
 * `ctx.entitlements` 是谁注入的、计量器怎么注册、判定口径怎么和前端对齐。
 *
 * ── 本文件 vs 直接用 `#admin/server/utils/entitlementGuard` ────────────────────
 * - **优先用本文件**：`hasEntitlement` / `assertEntitlements` / `remainingEntitlement` /
 *   `defineUsageResolvers` 覆盖了日常 90% 的场景，且签名与返回值语义在这里冻结，
 *   未来内部重构（守卫拆分、计量器搬家）不会波及调用方。
 * - 只有两种情况下才直接用 `entitlementGuard`：
 *   1. 需要 `assertEntitlement` 的 `delta` / `used` 参数（一次操作要占用多个额度、
 *      或调用方已经从自己的查询里算出了已用量，不想再让计量器查一遍）；
 *   2. 需要 `delta` 之外的细节（例如捕获 `deny` 的稳定原因码）。
 * - 下面这些 re-export 是**同一份实现**（不是副本），所以两种用法混着写也不会漂移。
 *
 * ── 判定口径（fail-closed / 隐藏项）──────────────────────────────────────────
 * - 未登录（`ctx.user` 缺失）：`hasEntitlement` = false；`assertEntitlement` 抛
 *   `auth.unauthorized`。任何受控能力都不可用，绝不「因为拿不到身份所以放行」。
 * - 能力键**未在能力目录（`meta`）登记**：一律拒绝（`hasEntitlement` = false，
 *   断言抛 `module.system.entitlement.denied`）。这既是 fail-closed，也能让拼错的键名
 *   立刻暴露，而不是静默放行。
 * - switch：只有数值 `=== 1` 算开启。
 * - quota：`UNLIMITED`（-1）算不限；其余 `> 0` 算「还有额度」。
 * - 管理员：`user.isAdmin === 1` 且该能力 `meta.adminBypass !== false` 时绕过（默认绕过）。
 * - 隐藏项（`meta.userShow === false`）：能力照常生效，只是拒绝文案不外露具体上限
 *   （`assertEntitlement` 内部已处理）；`remainingEntitlement` **不**因为隐藏而返回 0，
 *   隐藏只影响「能不能给端用户看」，不影响判定。
 * - 配额已用量：只在 `assertEntitlement` 里按 `meta.resolverKey ?? 功能键` 查计量器，
 *   查不到计量器且调用方没传 `used` 时**拒绝**（不能把未知用量当 0 放行）。
 */

import { isEntitlementOn, isUnlimited, remainingOf } from '#admin/shared/entitlement/types'
import type { EntitlementProfile } from '#admin/shared/entitlement/types'
import {
  assertEntitlement,
  getEntitlement,
  getEntitlementResolver,
  registerEntitlementResolver
} from '#admin/server/utils/entitlementGuard'
import type { EntitlementUsageResolver } from '#admin/server/utils/entitlementGuard'

// ── 原样透出的基础构件（纯函数 + 守卫）────────────────────────────────────────

export type { EntitlementKind, EntitlementMap, EntitlementMeta, EntitlementProfile } from '#admin/shared/entitlement/types'
export { UNLIMITED, isSwitchOn, isUnlimited, remainingOf, canCreate } from '#admin/shared/entitlement/types'
export { assertEntitlement, getEntitlement, listEntitlementResolvers, registerEntitlementResolver } from '#admin/server/utils/entitlementGuard'
export type { EntitlementUsageResolver } from '#admin/server/utils/entitlementGuard'

/**
 * 布尔判断，不抛错（前端/后端都可用；后端仅用于「展示/降级」判断，不要替代 assertEntitlement）。
 *
 * 口径与 `assertEntitlement` 完全一致（见文件头），**唯一差别**是它同步、不查计量器：
 * quota 只看「额度是否 > 0 或 不限」，因此它回答的是「这个能力开着吗」，
 * 而不是「这次操作一定放行吗」——配额是否已经用满只有异步断言知道。
 * 需要「这次能不能建第 N 个」请用 `assertEntitlement` / `assertEntitlements`。
 */
export function hasEntitlement(ctx: any, key: string): boolean {
  const user = ctx?.user
  const profile: EntitlementProfile | undefined = ctx?.entitlements ?? undefined
  const meta = profile?.meta?.[key]

  // 未登录 / 能力未登记：与断言一样拒绝（fail-closed）
  if (!user || !meta) {
    return false
  }

  // 管理员绕过：与 entitlementGuard 同一严格比较（`=== 1`）与同一默认值（不填即绕过）
  if (user.isAdmin === 1 && meta.adminBypass !== false) {
    return true
  }

  // switch / quota 的开关判定复用前端同源纯函数，避免出现第二份判定
  return isEntitlementOn(profile, key)
}

/**
 * 批量校验：任一不满足即抛（顺序执行，便于定位第一个失败项）。
 *
 * 顺序执行是刻意的：配额计量器可能要查库，并行会让「第一个失败项」随机；
 * 而且能力之间常常有先后依赖（先 `student.max` 再 `student.export`）。
 */
export async function assertEntitlements(ctx: any, keys: string[]): Promise<void> {
  for (const key of keys) {
    await assertEntitlement(ctx, key)
  }
}

/**
 * 剩余额度：不限返回 null。
 *
 * 取值口径（每一分支都与 `assertEntitlement` 对齐）：
 * - 未登录 / 能力键未登记：**0**（断言也必然拒绝，调用方不要把它当成「刚好用完」展示）；
 * - 管理员绕过（`meta.adminBypass !== false` 且 `isAdmin === 1`）：**null**（断言直接放行，视为不限）；
 * - switch 类：**null** —— 开关没有「额度」概念，返回 null 表示「不按额度计算」，
 *   与「不限」共用一个返回值；判断开关请用 `hasEntitlement` / `isSwitchOn`；
 * - quota 且 `UNLIMITED`：**null**；
 * - quota 其余：`max(0, 上限 - used)`。`used` 省略时用 `meta.resolverKey ?? key`
 *   找已注册的计量器（与断言同一个注册表）；**没有计量器且没传 used 时返回 0**
 *   （fail-closed：断言对这些情况同样拒绝，不能把未知用量当成 0 放行）。
 */
export async function remainingEntitlement(ctx: any, key: string, used?: number): Promise<number | null> {
  const user = ctx?.user
  const profile: EntitlementProfile | undefined = ctx?.entitlements ?? undefined
  const meta = profile?.meta?.[key]

  if (!user || !meta) {
    return 0
  }

  if (user.isAdmin === 1 && meta.adminBypass !== false) {
    return null
  }

  // 开关类没有额度语义（见上方说明）
  if (meta.kind !== 'quota') {
    return null
  }

  // 复用守卫的读取（未注入能力档案时按 0，与 getEntitlement 同口径）
  const limit = getEntitlement(ctx, key)

  if (isUnlimited(limit)) {
    return null
  }

  if (used !== undefined) {
    return remainingOf(limit, used)
  }

  const resolverKey = meta.resolverKey ?? key
  const resolver = getEntitlementResolver(resolverKey)

  if (!resolver) {
    return 0
  }

  return remainingOf(limit, await resolver(ctx, user.id))
}

/**
 * 批量注册计量器（宿主应用在 server plugin 里一次注册）。
 *
 * 等价于对每项调用 `registerEntitlementResolver`（同一个注册表、重复注册以最后一次为准），
 * 只是省掉一串单行调用。计量器签名与守卫一致：`(ctx, userId) => number | Promise<number>`。
 *
 * 注意：`meta.resolverKey` 必须与这里注册的键**逐字一致**，漏注册会让对应 quota
 * 能力在断言时被拒绝（`resolverMissing`），而不是按 0 放行。
 */
export function defineUsageResolvers(resolvers: Record<string, EntitlementUsageResolver>): void {
  for (const [resolverKey, resolver] of Object.entries(resolvers)) {
    registerEntitlementResolver(resolverKey, resolver)
  }
}
