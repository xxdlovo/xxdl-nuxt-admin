/**
 * 能力（entitlement）数据源扩展点。
 *
 * **本文件会被 `xxdl-admin-trade` 同名覆盖为「按会员等级解析」的实现**：
 * 基座独立运行时没有会员 / 套餐体系，因此默认返回空档案（不登记任何能力）；
 * 安装 trade 层后，由该层的 `server/utils/entitlementSource.ts` 提供
 * levelId / levelName / features / hiddenFeatures / meta。
 *
 * 覆盖之所以生效：调用方（server/trpc/middlewares/auth.ts、AuthService）用
 * Nitro 的 server/utils **自动导入**调用 `resolveEntitlements`，而自动导入按层优先级
 * （宿主 > trade > core）取同名导出；如果改成 `#admin/...` 显式导入，路径会写死到
 * 基座文件，trade 的同名实现永远不会生效。
 */

import { EMPTY_ENTITLEMENT_PROFILE } from '#admin/shared/entitlement/types'
import type { EntitlementProfile } from '#admin/shared/entitlement/types'

/**
 * 由上层（会员层）实现的数据源：默认实现表示「没有能力体系」，
 * 返回空档案 —— 没有登记任何能力键，因此后端能力校验会 fail-closed 拒绝，
 * 而不是悄悄放行（放行会掩盖上层漏实现 / 键名拼错）。
 */
export async function resolveEntitlements(ctx: any): Promise<EntitlementProfile> {
  void ctx

  return EMPTY_ENTITLEMENT_PROFILE
}
