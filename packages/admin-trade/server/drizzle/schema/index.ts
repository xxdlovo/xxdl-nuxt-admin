
// 电商域表定义入口。
//
// 该入口把「系统域的表」与「电商域的表」合并导出，因此电商域内部代码
// 只需从 `#trade/server/drizzle/schema` 引入即可拿到全部表定义，
// 无需区分表属于哪个层。
//
// 注意：不要在这里 re-export core 的 `*.ts` 具名表以外的内容，
// 以免与下方的本地表重名。

// 系统域（继承自 xxdl-admin-core）
export * from '#admin/server/drizzle/schema'

// 电商域（本层）
export { sysGoods } from "./system/goods"
export { sysGoodsLevelPrice } from "./system/goodsLevelPrice"
export { sysMember } from "./system/member"
export { sysMemberBalanceLog } from "./system/memberBalanceLog"
export { sysMemberCoupon } from "./system/memberCoupon"
export { sysMemberCouponUse } from "./system/memberCouponUse"
export { sysMemberFreeze } from "./system/memberFreeze"
export { sysMemberGiftGrant } from "./system/memberGiftGrant"
export { sysMemberInviteCode } from "./system/memberInviteCode"
export { sysMemberLevel } from "./system/memberLevel"
export { sysMemberLevelOrder } from "./system/memberLevelOrder"
export { sysMemberRecharge } from "./system/memberRecharge"
export { sysMemberWallet } from "./system/memberWallet"
export { sysOrder } from "./system/order"
export { sysPayChannel } from "./system/payChannel"
export { sysPayNotifyLog } from "./system/payNotifyLog"
export { sysPayOrder } from "./system/payOrder"
