/**
 * 全局日志中间件
 *
 * 记录：
 * - 调用接口路径
 * - 用户信息
 * - 执行耗时
 */
export const loggerMiddleware = async (opts: any) => {
    const { path, next } = opts

    const start = Date.now()

    console.log("[tRPC Request Start]", path)

    const result = await next()

    console.log("[tRPC Response End]", path, Date.now() - start,'毫秒')

    return result
}
