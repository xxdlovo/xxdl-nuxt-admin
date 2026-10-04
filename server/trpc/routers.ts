// routers.ts
import { router } from '~~/server/trpc/init'
import { sysUserRouter } from '#server/sys-router/user'
import { sysDeptRouter } from '#server/sys-router/dept'
import { demoRouter } from '#server/demo-router'
import { sysDictDataRouter } from '#server/sys-router/dictData'
import { sysDictTypeRouter } from '#server/sys-router/dictType'
import { sysMenuRouter } from '#server/sys-router/menu'
import { sysRoleRouter } from '#server/sys-router/role'
import { sysRoleMenuRouter } from '#server/sys-router/roleMenu'
import { sysLoginLogRouter } from '#server/sys-router/loginLog'
import { sysNoticeRouter } from '#server/sys-router/notice'
import { sysOauthAccountRouter } from '#server/sys-router/oauthAccount'
import { sysOauthConfigRouter } from '#server/sys-router/oauthConfig'
import { sysOssRouter } from '#server/sys-router/oss'
import { sysOssConfigRouter } from '#server/sys-router/ossConfig'
import { sysPayChannelRouter } from '#server/trade-router/modules/payChannel'
import { sysPayNotifyLogRouter } from '#server/trade-router/modules/payNotifyLog'
import { sysPayOrderRouter } from '#server/trade-router/modules/payOrder'
import { sysPayTestRouter } from '#server/trade-router/modules/payTest'
import { sysGoodsRouter } from '#server/trade-router/modules/goods'
import { sysOrderRouter } from '#server/trade-router/modules/order'
import { sysMemberRouter } from '#server/trade-router/modules/member'
import { sysMemberBalanceLogRouter } from '#server/trade-router/modules/memberBalanceLog'
import { sysMemberCouponRouter } from '#server/trade-router/modules/memberCoupon'
import { sysMemberFreezeRouter } from '#server/trade-router/modules/memberFreeze'
import { sysMemberLevelRouter } from '#server/trade-router/modules/memberLevel'
import { sysMemberLevelOrderRouter } from '#server/trade-router/modules/memberLevelOrder'
import { sysMemberRechargeRouter } from '#server/trade-router/modules/memberRecharge'
import { sysSystemLogRouter } from '#server/sys-router/systemLog'
import { sysUserRoleRouter } from '#server/sys-router/userRole'
import { authRouter } from '#server/sys-router/auth'
import { sysJobRouter } from '#server/sys-router/job'
import { sysJobLogRouter } from '#server/sys-router/jobLog'
import { sysConfigRouter } from '#server/sys-router/config'
import { sysStorageRouter } from '#server/sys-router/storage'
import { sysHomeRouter } from '#server/sys-router/home'

// 收集相关路由
export const appRouter = router({
    auth: authRouter,
    sysJob: sysJobRouter,
    sysJobLog: sysJobLogRouter,
    sysConfig: sysConfigRouter,
    sysStorage: sysStorageRouter,
    sysUser: sysUserRouter,
    sysDept: sysDeptRouter,
    demo: demoRouter,
    sysDictData: sysDictDataRouter,
    sysDictType: sysDictTypeRouter,
    sysMenu: sysMenuRouter,
    sysRole: sysRoleRouter,
    sysRoleMenu: sysRoleMenuRouter,
    sysLoginLog: sysLoginLogRouter,
    sysNotice: sysNoticeRouter,
    sysOauthAccount: sysOauthAccountRouter,
    sysOauthConfig: sysOauthConfigRouter,
    sysOss: sysOssRouter,
    sysOssConfig: sysOssConfigRouter,
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
    systemLog: sysSystemLogRouter,
    sysUserRole: sysUserRoleRouter,
    sysHome: sysHomeRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
