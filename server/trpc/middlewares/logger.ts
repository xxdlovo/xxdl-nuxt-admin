import { logRecorder } from '#server/sys-router/systemLog/LogRecorderService'

type OperationLogPolicyInput = {
    /**
     * tRPC operation type, usually query, mutation, or subscription.
     */
    type: string
    /**
     * 由 proc({ log }) 显式声明的开关。
     * proc() 已把默认值归一为 true，因此这里的 undefined 只可能来自
     * 未经过 proc() 的 procedure（如 protectedProcedure）。
     */
    log?: boolean
}

/**
 * 是否记录操作日志。
 *
 * 1. proc({ log }) 显式指定时以它为准：true 记录，false 跳过；
 * 2. 未指定时按 operation type 判断：
 *    mutation 记录，query 不记录（page/get/getOne/getById 这类读操作
 *    过于频繁，不适合写入审计日志）。
 */
function shouldRecordOperationLog(input: OperationLogPolicyInput) {
    if (input.log !== undefined) {
        return input.log
    }

    return input.type === 'mutation'
}

/**
 * Global tRPC log middleware.
 */
export const loggerMiddleware = async (opts: any) => {
    const { path, type, ctx, next, meta } = opts

    if (!shouldRecordOperationLog({ type, log: meta?.log })) {
        return next()
    }

    const start = Date.now()
    const requestParams = opts.getRawInput ? await opts.getRawInput() : opts.input

    try {
        const result = await next()
        const cost = Date.now() - start

        if (result?.ok === false) {
            await logRecorder(ctx).systemFailure(
                path,
                result.error,
                `${type} ${path} failed ${cost}ms`,
                {
                    trpcType: type,
                    trpcPath: path,
                    durationMs: cost,
                    requestParams
                }
            )
        }
        else {
            await logRecorder(ctx).systemSuccess(
                path,
                `${type} ${path} success ${cost}ms`,
                {
                    trpcType: type,
                    trpcPath: path,
                    durationMs: cost,
                    requestParams,
                    requestResult: result?.data
                }
            )
        }

        return result
    }
    catch (error) {
        const cost = Date.now() - start

        await logRecorder(ctx).systemFailure(
            path,
            error,
            `${type} ${path} failed ${cost}ms`,
            {
                trpcType: type,
                trpcPath: path,
                durationMs: cost,
                requestParams
            }
        )

        throw error
    }
}
