import { TRPCError } from '@trpc/server'
import { getCookie, getHeader } from 'h3'
import type { TRPCFormattedError } from '#shared/types/common'
import { AppError, resolveAppErrorStatus } from '#server/utils/appError'
import { createLocaleT } from '#server/utils/serverI18n'

type ErrorFormatterOpts = {
    error: TRPCError;
    shape: {
        data: any;
        [key: string]: any;
    };
    ctx?: any;
};

const supportedLocales = new Set(['en', 'zh'])

/**
 * 是否在响应体里返回堆栈。
 *
 * 默认关闭：堆栈会暴露服务器绝对路径与内部实现，对调用方没有意义；
 * 需要排查时设置 `NUXT_TRPC_ERROR_STACK=true`。
 * 失败的写操作本来就会连堆栈一起写入 `sys_system_log`（loggerMiddleware），
 * 因此关掉响应堆栈不会丢排查线索。
 */
function includeErrorStack() {
    return process.env.NUXT_TRPC_ERROR_STACK === 'true'
}

/**
 * 是否把内部错误原文返回给客户端。
 *
 * 数据库异常的 message 里可能带 SQL、表名与字段名，程序异常（TypeError 等）
 * 也可能泄露实现细节，因此只在非生产环境返回原文，生产环境统一返回分类文案。
 */
function exposeInternalErrorDetail() {
    return process.env.NODE_ENV !== 'production'
}

function normalizeLocale(locale?: string | null) {
    if (!locale) {
        return null
    }

    const normalized = locale.toLowerCase().split(',')[0]?.trim().split('-')[0]
    return normalized && supportedLocales.has(normalized) ? normalized : null
}

function getRequestLocale(ctx?: any) {
    const event = ctx?.event

    if (!event) {
        return 'en'
    }

    return normalizeLocale(getHeader(event, 'x-locale'))
        ?? normalizeLocale(getCookie(event, 'i18n_locale'))
        ?? normalizeLocale(getHeader(event, 'accept-language'))
        ?? 'en'
}

export const errorFormatter = ({ shape, error, ctx }: ErrorFormatterOpts) => {
    const locale = getRequestLocale(ctx)
    const $t = createLocaleT(locale)

    let customMessage = error.message
    let errorType = $t('system.serverError')
    let trpcCode = shape.data.code
    let httpStatus = shape.data.httpStatus
    let i18nKey: string | undefined

    /**
     * i18n key 不存在时 `$t` 会原样返回 key，直接用会让用户看到 "module.xxx.yyy"，
     * 因此翻译结果与 key 相同时回退到分类文案。
     */
    const translateOr = (key: string, fallback: string, params?: Record<string, unknown>) => {
        const translated = $t(key, params)
        return translated === key ? fallback : translated
    }

    if (error.cause instanceof AppError) {
        i18nKey = error.cause.i18nKey

        /**
         * AppError 允许把参数放在 message 里（例如优惠码门槛金额：
         * 「最低 {message} 元」）；message 与 key 相同说明没带参数，此时不传。
         */
        const params = error.cause.message && error.cause.message !== i18nKey
            ? { message: error.cause.message }
            : undefined

        // type 是前端 toast 的标题、message 是描述（见 app/plugins/01.client.ts），
        // 两者都填翻译文案会导致提示内容重复，因此 type 固定用错误分类。
        errorType = $t('system.businessError')
        customMessage = translateOr(i18nKey, $t('system.businessError'), params)

        // 业务错误按语义映射到 4xx：前端可据此按 code 分支，
        // 监控与网关也能把「请求有问题」和「服务端异常」分开统计。
        const status = resolveAppErrorStatus(i18nKey)
        trpcCode = status.code
        httpStatus = status.httpStatus
    }
    else if (isZodError(error.cause)) {
        errorType = $t('system.zodError')
        customMessage = collectZodMessages(error.cause, $t)
    }
    else if (isDatabaseError(error.cause)) {
        errorType = $t('system.dbError')
        const dbErr = error.cause as any

        // Drizzle 会把驱动错误包成 DrizzleQueryError，真正的驱动错误在 cause 上：
        // mysql2 的字段是 sqlMessage / sql，SQL 语句本身只在 sql 里。
        const detail = dbErr.cause?.sqlMessage ?? dbErr.cause?.message
        const sql = typeof dbErr.cause?.sql === 'string' ? dbErr.cause.sql : undefined

        customMessage = exposeInternalErrorDetail()
            ? ([detail, sql].filter(Boolean).join(' | ') || 'Database error')
            : $t('system.dbError')
    }
    else if (error.cause instanceof Error) {
        errorType = $t('system.serverError')
        customMessage = exposeInternalErrorDetail() ? error.cause.message : $t('system.serverError')
    }

    // 兜底：message 本身就是 i18n key 时再翻译一次（例如 Repo 层直接抛 key）
    if (customMessage && customMessage.includes('.') && !customMessage.includes('，')) {
        const translated = $t(customMessage)
        if (translated !== customMessage) {
            customMessage = translated
        }
    }

    shape.message = customMessage
    return {
        ...shape,
        data: {
            ...shape.data,
            type: errorType,
            message: customMessage,
            i18nKey,
            code: trpcCode,
            httpStatus,
            stack: includeErrorStack() ? error.stack : undefined,
            timestamp: new Date().toISOString()
        } as TRPCFormattedError,
    }
}

function isDatabaseError(cause: unknown): boolean {
    if (!cause || typeof cause !== 'object') return false

    const err = cause as any

    return (
        typeof err.cause?.code === 'string' ||
        typeof err.cause?.sql === 'string' ||
        typeof err.cause?.constraint === 'string'
    )
}

type ZodLikeError = {
    issues?: Array<{ message?: string }>
    flatten?: () => {
        fieldErrors?: Record<string, string[] | undefined>
        formErrors?: string[]
    }
}

/**
 * 是否为 Zod 校验错误。
 *
 * 用 `name` 判断而不是 `instanceof ZodError`：zod 同时提供 ESM 与 CJS 入口，
 * 依赖树里出现多份实例时 instanceof 会失效；而且 zod 4 的 ZodError 并不是
 * 同一个 Error 类的实例，经过 tRPC 的 cause 规范化后可能只剩 name / message。
 */
function isZodError(cause: unknown): cause is ZodLikeError {
    if (!cause || typeof cause !== 'object') return false

    return (cause as any).name === 'ZodError'
}

/**
 * 汇总 Zod 校验消息（消息本身可能是 i18n key，由调用方翻译）。
 *
 * 优先读 `issues`；读不到时退回 `flatten()`；两者都不可用（cause 被包装成只保留
 * name/message 的对象）时返回通用文案——绝不能把 ZodError 的 message
 * （原始 JSON issue 数组）直接展示给用户。
 */
function collectZodMessages(cause: ZodLikeError, $t: (key: string) => string): string {
    const messages: string[] = []

    if (Array.isArray(cause.issues)) {
        for (const issue of cause.issues) {
            if (typeof issue?.message === 'string' && issue.message) {
                messages.push($t(issue.message))
            }
        }
    }
    else if (typeof cause.flatten === 'function') {
        const { fieldErrors, formErrors } = cause.flatten()

        for (const errors of Object.values(fieldErrors ?? {})) {
            for (const message of errors ?? []) {
                messages.push($t(message))
            }
        }

        for (const message of formErrors ?? []) {
            messages.push($t(message))
        }
    }

    const unique = [...new Set(messages.filter(Boolean))]

    return unique.length > 0 ? unique.join('，') : $t('common.pleaseCheckValue')
}
