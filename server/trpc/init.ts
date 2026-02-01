import { initTRPC } from '@trpc/server';
import type { Context } from './context';
import { errorFormatter} from './errorFormatter'
import { loggerMiddleware } from './middlewares/logger'
import { authMiddleware } from './middlewares/auth'
// 初始化trpc
export const t = initTRPC.context<Context>().create({
        errorFormatter
    });


export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure  = publicProcedure.use(loggerMiddleware).use(authMiddleware)
// 自定义验证
export const customProcedure = t.procedure.use(async (opts) => {
  const {ctx} = opts;
  return opts.next()
});
