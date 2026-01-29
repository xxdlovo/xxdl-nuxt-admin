import { router } from '~~/server/trpc/init'
import { sysUserRouter } from '#server/sys-router/user'

// 收集相关路由
export const appRouter = router({
    sysUser: sysUserRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;