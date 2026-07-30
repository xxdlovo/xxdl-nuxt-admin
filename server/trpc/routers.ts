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
import { sysOssRouter } from '#server/sys-router/oss'
import { sysOssConfigRouter } from '#server/sys-router/ossConfig'
import { sysSystemLogRouter } from '#server/sys-router/systemLog'
import { sysUserRoleRouter } from '#server/sys-router/userRole'
import { authRouter } from '#server/sys-router/auth'
import { sysJobRouter } from '#server/sys-router/job'
import { sysJobLogRouter } from '#server/sys-router/jobLog'
import { sysConfigRouter } from '#server/sys-router/config'

// 收集相关路由
export const appRouter = router({
    auth: authRouter,
    sysJob: sysJobRouter,
    sysJobLog: sysJobLogRouter,
    sysConfig: sysConfigRouter,
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
    sysOss: sysOssRouter,
    sysOssConfig: sysOssConfigRouter,
    systemLog: sysSystemLogRouter,
    sysUserRole: sysUserRoleRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
