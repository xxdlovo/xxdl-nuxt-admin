/**
 * `xxdl-admin-trade` 的对外服务门面（public API）汇总出口。
 *
 * 宿主应用 / 其它层统一从这里按需导入，例如：
 *
 * ```ts
 * import { chargeBalance, getBalance } from '#trade/server/exports'
 * import { openMemberLevel } from '#trade/server/exports'
 * ```
 *
 * 目录约定：本目录**不在** Nitro 的扫描范围内（只扫 `server/utils`、`server/api`、
 * `server/middleware`、`server/plugins`、`server/routes`），因此这里的符号不会被自动导入，
 * 必须显式 import —— 这正是「门面」要的效果：没有全局污染、没有 Duplicated imports。
 *
 * 分层：`trade → core` 单向。core 侧的能力门面在 `#admin/server/exports/entitlement`。
 */

export * from './billing'
export * from './membership'
export * from './session'
