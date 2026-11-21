/**
 * 能力档案（entitlement）在**原生 Nitro 接口**里的补全过程。
 *
 * 为什么需要：
 * - tRPC 的 `authMiddleware` 在确认登录后会把解析好的能力档案写进 `ctx.entitlements`，
 *   所以 tRPC resolver 里直接 `assertEntitlement(ctx, key)` 就能用；
 * - `server/api/**` 的原生接口没有这层中间件，`createContext(event)` 只给出
 *   `entitlements: null`，此时守卫会把「没有档案」当成「能力未登记」按 fail-closed 拒绝，
 *   表现是所有受控能力都 403，而不是「能读到真实配额」。
 *
 * 因此原生接口在断言前先 `await ensureEntitlements(ctx)`：档案已存在就直接复用（tRPC 与
 * 原生路由共用同一个上下文时不会重复解析），否则调用 trade 自己的数据源解析一次并写回 ctx。
 *
 * 注意导入路径：这里**必须**从 `#trade/server/utils/entitlementSource` 显式导入。
 * 覆盖机制（trade 覆盖基座 `#admin/server/utils/entitlementSource`）只作用于 Nitro
 * `server/utils` 的**自动导入**调用点；本文件里显式写 `#admin/...` 反而会拿到基座空实现。
 */
import type { EntitlementProfile } from '#admin/shared/entitlement/types'
import { resolveEntitlements } from '#trade/server/utils/entitlementSource'

/**
 * 确保 `ctx.entitlements` 已解析（原生接口里用；tRPC 由 authMiddleware 自动注入）。
 *
 * @param ctx 原生接口里 `createContext(event)` 返回的上下文（签名用 `any` 与守卫保持一致）
 * @returns 当前请求的能力档案；未登录时是 `features` 为空的档案（断言随后按 401 拒绝）
 */
export async function ensureEntitlements(ctx: any): Promise<EntitlementProfile> {
  // 已注入：tRPC 的 authMiddleware 已经解析过，直接复用同一个对象
  const injected = ctx?.entitlements

  if (injected && typeof injected.then !== 'function') {
    return injected as EntitlementProfile
  }

  const profile = await resolveEntitlements(ctx)

  // 写回 ctx：同一请求里后续的 assertEntitlement / getEntitlement 都读这一份，
  // 避免一个请求内多次查库（与 authMiddleware 的写法一致）。
  if (ctx && typeof ctx === 'object') {
    ctx.entitlements = profile
  }

  return profile
}
