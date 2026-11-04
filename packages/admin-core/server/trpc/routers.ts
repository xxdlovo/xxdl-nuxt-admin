// routers.ts
import { router } from '#admin/server/trpc/init'
import { sysUserRouter } from '#admin/server/sys-router/user'
import { sysDeptRouter } from '#admin/server/sys-router/dept'
import { demoRouter } from '#admin/server/demo-router'
import { sysDictDataRouter } from '#admin/server/sys-router/dictData'
import { sysDictTypeRouter } from '#admin/server/sys-router/dictType'
import { sysMenuRouter } from '#admin/server/sys-router/menu'
import { sysRoleRouter } from '#admin/server/sys-router/role'
import { sysRoleMenuRouter } from '#admin/server/sys-router/roleMenu'
import { sysLoginLogRouter } from '#admin/server/sys-router/loginLog'
import { sysNoticeRouter } from '#admin/server/sys-router/notice'
import { sysOauthAccountRouter } from '#admin/server/sys-router/oauthAccount'
import { sysOauthConfigRouter } from '#admin/server/sys-router/oauthConfig'
import { sysOssRouter } from '#admin/server/sys-router/oss'
import { sysOssConfigRouter } from '#admin/server/sys-router/ossConfig'
import { sysPayChannelRouter } from '#admin/server/trade-router/modules/payChannel'
import { sysPayNotifyLogRouter } from '#admin/server/trade-router/modules/payNotifyLog'
import { sysPayOrderRouter } from '#admin/server/trade-router/modules/payOrder'
import { sysPayTestRouter } from '#admin/server/trade-router/modules/payTest'
import { sysGoodsRouter } from '#admin/server/trade-router/modules/goods'
import { sysOrderRouter } from '#admin/server/trade-router/modules/order'
import { sysMemberRouter } from '#admin/server/trade-router/modules/member'
import { sysMemberBalanceLogRouter } from '#admin/server/trade-router/modules/memberBalanceLog'
import { sysMemberCouponRouter } from '#admin/server/trade-router/modules/memberCoupon'
import { sysMemberFreezeRouter } from '#admin/server/trade-router/modules/memberFreeze'
import { sysMemberLevelRouter } from '#admin/server/trade-router/modules/memberLevel'
import { sysMemberLevelOrderRouter } from '#admin/server/trade-router/modules/memberLevelOrder'
import { sysMemberRechargeRouter } from '#admin/server/trade-router/modules/memberRecharge'
import { sysSystemLogRouter } from '#admin/server/sys-router/systemLog'
import { sysUserRoleRouter } from '#admin/server/sys-router/userRole'
import { authRouter } from '#admin/server/sys-router/auth'
import { sysJobRouter } from '#admin/server/sys-router/job'
import { sysJobLogRouter } from '#admin/server/sys-router/jobLog'
import { sysConfigRouter } from '#admin/server/sys-router/config'
import { sysStorageRouter } from '#admin/server/sys-router/storage'
import { sysHomeRouter } from '#admin/server/sys-router/home'
import { showCaseRouter } from '#admin/server/show-case-router'

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
    showCase: showCaseRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
