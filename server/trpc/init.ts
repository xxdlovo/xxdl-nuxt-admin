import { initTRPC } from '@trpc/server';
import type { Context } from './context';

// 初始化trpc
const t = initTRPC.context<Context>().create();


export const router = t.router;
export const publicProcedure = t.procedure;

// 自定义验证
export const customProcedure = t.procedure.use(async (opts) => {
  const {ctx} = opts;
  return opts.next()
});
