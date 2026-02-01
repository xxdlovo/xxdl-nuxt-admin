import { TRPCError } from "@trpc/server"

/**
 * 全局异常格式化
 *
 * 用于统一返回错误结构：
 * - code
 * - message
 * - stack（开发环境）
 */
export const errorFormatter = ({ shape, error }: any) => {
    return {
        ...shape,
        data: {
            ...shape.data,
            code: error.code,
            message: error.message,
            // TODO: 生产环境不要返回 stack
            stack: process.env.NODE_ENV === "development"
                ? error.stack
                : undefined,
        },
    }
}
