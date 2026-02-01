import { TRPCError } from "@trpc/server"
import { t } from "../init"

/**
 * 登录认证中间件
 *
 * 用于 protectedProcedure：
 * - 必须登录
 * - ctx.user 必须存在
 */
export const authMiddleware = (opts:any) => {
    // TODO: 替换为你的真实登录判断逻辑
    const { path, next,ctx } = opts
    return next({
        ctx
    })
}

