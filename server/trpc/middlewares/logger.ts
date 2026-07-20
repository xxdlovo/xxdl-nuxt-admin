import { logRecorder } from '#server/sys-router/systemLog/LogRecorderService'

type OperationLogPolicyInput = {
    /**
     * tRPC operation type, usually query, mutation, or subscription.
     */
    type: string
    /**
     * tRPC router path, for example systemLog.page or user.update.
     */
    path: string
}

/**
 * Queries are intentionally excluded because page/get/getOne/getById calls are
 * read-only and usually too noisy for operation audit logs.
 */
const DEFAULT_RECORDED_OPERATION_TYPES = new Set(['mutation'])

/**
 * Keep this list small. Use it only for sensitive reads such as exporting data,
 * viewing secrets, or reading private audit details.
 */
const FORCE_RECORDED_QUERY_PATHS = new Set<string>([
])

/**
 * Add noisy or technical mutations here if they are not meaningful user actions.
 */
const SKIPPED_OPERATION_PATHS = new Set<string>([
])

function shouldRecordOperationLog(input: OperationLogPolicyInput) {
    if (SKIPPED_OPERATION_PATHS.has(input.path)) {
        return false
    }

    if (FORCE_RECORDED_QUERY_PATHS.has(input.path)) {
        return true
    }

    return DEFAULT_RECORDED_OPERATION_TYPES.has(input.type)
}

/**
 * Global tRPC log middleware.
 */
export const loggerMiddleware = async (opts: any) => {
    const { path, type, ctx, next } = opts

    if (!shouldRecordOperationLog({ path, type })) {
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
