// 基座（core）的 tRPC 路由注册表。
//
// 这里只注册**系统域**的路由。电商域（会员/商品/订单/支付/钱包）属于
// 可选的 `xxdl-admin-trade` 层，由该层通过 `mergeRouters` 合并后再注册，
// 见 packages/admin-trade/server/trpc/routers.ts。
//
// 为什么不在本文件里做「可选导入」：
// ESM 的静态 import 无法表达「模块不存在则跳过」，而 Nuxt Layer 的覆盖机制
// 只作用于 Nuxt 自动扫描的目录（pages/components），不影响显式 import 的
// 物理路径。因此电商域改为**覆盖 API handler** 的方式接入，见
// packages/admin-trade/server/api/trpc/[trpc].ts。
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
import { sysSystemLogRouter } from '#admin/server/sys-router/systemLog'
import { sysUserRoleRouter } from '#admin/server/sys-router/userRole'
import { authRouter } from '#admin/server/sys-router/auth'
import { sysJobRouter } from '#admin/server/sys-router/job'
import { sysJobLogRouter } from '#admin/server/sys-router/jobLog'
import { sysConfigRouter } from '#admin/server/sys-router/config'
import { sysStorageRouter } from '#admin/server/sys-router/storage'
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
    systemLog: sysSystemLogRouter,
    sysUserRole: sysUserRoleRouter,
    showCase: showCaseRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
