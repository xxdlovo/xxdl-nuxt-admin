// routers.ts
import { router } from '~~/server/trpc/init'
import { sysUserRouter } from '#server/sys-router/user'
import { sysDeptRouter } from '#server/sys-router/dept'
import { demoRouter } from '#server/demo-router'
import { sysDictDataRouter } from '#server/sys-router/dictData'
import { sysDictTypeRouter } from '#server/sys-router/dictType'
import { sysMenuRouter } from '#server/sys-router/menu'

// 收集相关路由
export const appRouter = router({
    sysUser: sysUserRouter,
    sysDept: sysDeptRouter,
    demo: demoRouter,
    sysDictData: sysDictDataRouter,
    sysDictType: sysDictTypeRouter,
    sysMenu: sysMenuRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;