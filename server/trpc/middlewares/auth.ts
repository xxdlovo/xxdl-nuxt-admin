import { TRPCError } from "@trpc/server"
import { t } from "../init"

/**
 * 登录认证中间件
 *
 * 用于 protectedProcedure：
 * - 必须登录
 * - ctx.user 必须存在
 */
export const authMiddleware = t.middleware(({ ctx, next }) => {
    // TODO: 替换为你的真实登录判断逻辑
    // const user = ctx.db
    //
    // if (!user) {
    //     throw new TRPCError({
    //         code: "UNAUTHORIZED",
    //         message: "未登录或登录已过期",
    //     })
    // }

    return next({
        ctx
    })
})
