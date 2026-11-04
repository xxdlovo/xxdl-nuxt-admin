// 电商层（trade）的 tRPC 路由注册表。
//
// 该文件合并「基座路由 + 电商域路由」，并通过同路径的
// `server/api/trpc/[trpc].ts` 覆盖基座的 handler 完成注册。
//
// 依赖方向：trade → core（单向）。基座不认识电商域的任何 router。
import { t, router } from '#admin/server/trpc/init'
import { appRouter as coreAppRouter } from '#admin/server/trpc/routers'
import { sysPayChannelRouter } from '#trade/server/trade-router/modules/payChannel'
import { sysPayNotifyLogRouter } from '#trade/server/trade-router/modules/payNotifyLog'
import { sysPayOrderRouter } from '#trade/server/trade-router/modules/payOrder'
import { sysPayTestRouter } from '#trade/server/trade-router/modules/payTest'
import { sysGoodsRouter } from '#trade/server/trade-router/modules/goods'
import { sysOrderRouter } from '#trade/server/trade-router/modules/order'
import { sysMemberRouter } from '#trade/server/trade-router/modules/member'
import { sysMemberBalanceLogRouter } from '#trade/server/trade-router/modules/memberBalanceLog'
import { sysMemberCouponRouter } from '#trade/server/trade-router/modules/memberCoupon'
import { sysMemberFreezeRouter } from '#trade/server/trade-router/modules/memberFreeze'
import { sysMemberLevelRouter } from '#trade/server/trade-router/modules/memberLevel'
import { sysMemberLevelOrderRouter } from '#trade/server/trade-router/modules/memberLevelOrder'
import { sysMemberRechargeRouter } from '#trade/server/trade-router/modules/memberRecharge'
import { sysHomeRouter } from '#trade/server/sys-router/home'

/** 电商域路由集合 */
export const tradeRouter = router({
    sysPayChannel: sysPayChannelRouter,
    sysPayNotifyLog: sysPayNotifyLogRouter,
    sysPayOrder: sysPayOrderRouter,
    sysPayTest: sysPayTestRouter,
    sysGoods: sysGoodsRouter,
    sysOrder: sysOrderRouter,
    sysMember: sysMemberRouter,
    sysMemberBalanceLog: sysMemberBalanceLogRouter,
    sysMemberCoupon: sysMemberCouponRouter,
    sysMemberFreeze: sysMemberFreezeRouter,
    sysMemberLevel: sysMemberLevelRouter,
    sysMemberLevelOrder: sysMemberLevelOrderRouter,
    sysMemberRecharge: sysMemberRechargeRouter,
    sysHome: sysHomeRouter
})

/** 对外暴露的完整路由（基座 + 电商） */
export const appRouter = t.mergeRouters(coreAppRouter, tradeRouter)

// export type definition of API
export type AppRouter = typeof appRouter
