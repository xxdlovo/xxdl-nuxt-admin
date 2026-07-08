// routers.ts
import { router } from '~~/server/trpc/init'
import { sysUserRouter } from '#server/sys-router/user'
import { demoRouter } from '#server/demo-router'

// 收集相关路由
export const appRouter = router({
    sysUser: sysUserRouter,
    demo: demoRouter
});

// export type definition of API
export type AppRouter = typeof appRouter;