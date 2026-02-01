import { t } from "../init"

/**
 * 全局日志中间件
 *
 * 记录：
 * - 调用接口路径
 * - 用户信息
 * - 执行耗时
 */
export const loggerMiddleware = t.middleware(async ({ path, ctx, next }) => {
    const start = Date.now()

    // TODO: 替换为你的日志系统（pino/winston/数据库）
    console.log("[tRPC Request]", {
        path,
    })

    const result = await next()

    const duration = Date.now() - start

    console.log("[tRPC Response]", {
        path,
        duration: `${duration}ms`,
        success: result.ok,
    })

    return result
})
