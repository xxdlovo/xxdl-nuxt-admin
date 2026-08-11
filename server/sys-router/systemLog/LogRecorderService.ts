import type { Context } from '#server/trpc/context'
import { sysLoginLogService } from '#server/sys-router/loginLog/SysLoginLogService'
import { sysSystemLogService } from '#server/sys-router/systemLog/SysSystemLogService'
import { getRequestInfo } from '#server/utils/requestInfo'
import { AppError } from '#server/utils/appError'

/**
 * 系统操作日志级别，对应 sys_system_log.level。
 */
const LOG_LEVEL = {
    info: 0,
    warn: 1,
    error: 2,
    debug: 3
} as const

/**
 * 日志结果状态，对应 sys_login_log.status 和 sys_system_log.status。
 */
const LOG_STATUS = {
    success: 1,
    failure: 2
} as const

/**
 * 记录请求参数和响应结果时需要脱敏的字段名。
 * 统一转为小写后匹配，因此这里保持小写写法。
 */
const SENSITIVE_PARAM_KEYS = new Set([
    'password',
    'oldpassword',
    'newpassword',
    'confirmpassword',
    'token',
    'accesstoken',
    'access_token',
    'refreshtoken',
    'refresh_token',
    'authorization'
])

/**
 * 日志载荷最大递归深度，避免深层对象或循环结构拖慢日志写入。
 */
const MAX_LOG_PAYLOAD_DEPTH = 6
/**
 * 单个字符串字段的最大保留长度。
 */
const MAX_LOG_STRING_LENGTH = 2000
/**
 * 单次请求体/响应体序列化后的最大保留长度。
 */
const MAX_LOG_JSON_STRING_LENGTH = 12000

/**
 * 按接口单独控制日志载荷清洗。
 *
 * - requestPath 匹配 server/api 的真实 URL pathname。
 * - trpcPath 匹配 tRPC router path。
 * - requestParamsOmitKeys/requestResultOmitKeys 支持字段名或点号路径，如 ctx、input.ctx。
 * - 字符串 pattern 以 * 结尾时按前缀匹配，否则按精确匹配。
 */
const LOG_PAYLOAD_POLICIES: LogPayloadPolicy[] = [
    {
        requestPath: '/api/xxx/stream',
        requestParamsOmitKeys: ['input.ctx.req1', 'input.ctx.req2', 'input.req3']
    }
]

/**
 * 系统操作日志级别类型。
 */
type LogLevel = typeof LOG_LEVEL[keyof typeof LOG_LEVEL]
/**
 * 日志结果状态类型。
 */
type LogStatus = typeof LOG_STATUS[keyof typeof LOG_STATUS]

type LogPayloadPattern = string | RegExp

type LogPayloadPolicy = {
    requestPath?: LogPayloadPattern
    trpcPath?: LogPayloadPattern
    requestParamsOmitKeys?: string[]
    requestResultOmitKeys?: string[]
}

type LogPayloadPolicyInput = {
    requestPath?: string | null
    trpcPath?: string | null
}

type LogPayloadSanitizeOptions = {
    omitKeys?: Set<string>
    path?: string[]
}

/**
 * 登录日志的业务补充信息。
 * IP、浏览器、系统、User-Agent、当前用户等请求上下文信息会在 logRecorder 内部自动获取。
 */
type LoginLogOptions = {
    /**
     * 登录时输入的用户名。登录失败时 ctx.user 为空，需要从业务侧补充。
     */
    username?: string | null
    /**
     * 用户 ID 覆盖值。登录成功时通常由 ctx.user 自动推导。
     */
    userId?: string | null
    /**
     * 登录地点。当前保持可选，后续接入 IP 归属地解析后可自动填充。
     */
    location?: string | null
    /**
     * 日志列表中展示的可读备注。
     */
    remark?: string | null
    /**
     * 登录方式，例如 password、sms、oauth。
     */
    loginType?: string | null
    /**
     * 登录失败时的业务错误码或 i18n key。
     */
    errorCode?: string | null
}

/**
 * 系统操作日志完整业务入参。
 * 请求信息和用户信息会在 logRecorder 内部解析，调用方只需要传递业务事实。
 */
type SystemLogOptions = {
    /**
     * 日志级别，默认 info。
     */
    level?: LogLevel
    /**
     * 业务模块名，通常可传 tRPC path 或菜单模块名。
     */
    module?: string | null
    /**
     * 日志消息，建议传可读的操作描述。
     */
    message: string
    /**
     * 错误堆栈或诊断信息。
     */
    trace?: string | null
    /**
     * 操作结果，默认 success。
     */
    status?: LogStatus
    /**
     * 日志列表中展示的可读备注。
     */
    remark?: string | null
    /**
     * HTTP 方法。默认从当前请求中获取。
     */
    requestMethod?: string | null
    /**
     * HTTP 请求路径。默认从当前请求中获取。
     */
    requestPath?: string | null
    /**
     * tRPC 操作类型，例如 query、mutation。
     */
    trpcType?: string | null
    /**
     * tRPC router path。
     */
    trpcPath?: string | null
    /**
     * 接口执行耗时，单位毫秒。
     */
    durationMs?: number | null
    /**
     * 请求参数。写入前会统一脱敏和截断。
     */
    requestParams?: unknown
    /**
     * 响应结果。写入前会统一脱敏和截断。
     */
    requestResult?: unknown
    /**
     * 业务错误码、tRPC code 或 i18n key。
     */
    errorCode?: string | null
}

/**
 * 快捷方法的可选入参。
 * message 和 level 由快捷方法固定，其余元数据仍允许覆盖。
 */
type SystemShortcutOptions = Omit<SystemLogOptions, 'level' | 'message'>

/**
 * 截断数据库字段，空值统一返回 undefined，便于 create 方法按可选字段处理。
 */
function truncate(value: string | null | undefined, maxLength: number) {
    if (!value) {
        return undefined
    }

    return value.length > maxLength ? value.slice(0, maxLength) : value
}

/**
 * 将未知错误转换为可写入 trace 字段的文本。
 */
function toTrace(error: unknown) {
    if (!error) {
        return undefined
    }

    if (error instanceof Error) {
        return error.stack || error.message
    }

    return String(error)
}

/**
 * 从业务错误、tRPC 错误或 cause 中提取错误码。
 */
function toErrorCode(error: unknown) {
    if (!error) {
        return undefined
    }

    if (error instanceof AppError) {
        return error.i18nKey
    }

    const maybeError = error as any
    return maybeError?.code ?? maybeError?.cause?.i18nKey ?? maybeError?.cause?.code
}

/**
 * 控制单个请求体/响应体的整体大小，避免把过大的对象直接写入日志表。
 */
function limitLogPayloadSize(value: unknown): unknown {
    if (value == null) {
        return value
    }

    try {
        const text = JSON.stringify(value)

        if (text.length <= MAX_LOG_JSON_STRING_LENGTH) {
            return value
        }

        return {
            truncated: true,
            length: text.length,
            preview: text.slice(0, MAX_LOG_JSON_STRING_LENGTH)
        }
    }
    catch {
        return String(value)
    }
}

function matchLogPayloadPattern(pattern: LogPayloadPattern | undefined, value: string | null | undefined) {
    if (!pattern || !value) {
        return false
    }

    if (pattern instanceof RegExp) {
        return pattern.test(value)
    }

    if (pattern.endsWith('*')) {
        return value.startsWith(pattern.slice(0, -1))
    }

    return value === pattern
}

function resolveLogPayloadPolicy(input: LogPayloadPolicyInput) {
    return LOG_PAYLOAD_POLICIES.find(policy =>
        matchLogPayloadPattern(policy.requestPath, input.requestPath)
        || matchLogPayloadPattern(policy.trpcPath, input.trpcPath)
    )
}

function createOmitKeySet(keys: string[] | undefined) {
    return new Set(keys?.map(key => key.toLowerCase()) ?? [])
}

function shouldOmitLogPayloadKey(
    key: string,
    options: LogPayloadSanitizeOptions | undefined,
) {
    if (!options?.omitKeys?.size) {
        return false
    }

    const currentPath = [...(options.path ?? []), key].join('.').toLowerCase()
    const normalizedKey = key.toLowerCase()

    return options.omitKeys.has(normalizedKey) || options.omitKeys.has(currentPath)
}

function applyLogPayloadPolicy(value: unknown, omitKeys?: string[]) {
    return sanitizeLogPayload(value, {
        omitKeys: createOmitKeySet(omitKeys)
    })
}

/**
 * 日志载荷清洗：
 * - 敏感字段脱敏
 * - 深层对象截断
 * - 循环引用替换
 * - bigint/function/symbol 等不可稳定 JSON 化的值安全处理
 */
function sanitizeLogPayload(
    value: unknown,
    options: LogPayloadSanitizeOptions = {},
    depth = 0,
    seen = new WeakSet<object>(),
): unknown {
    if (typeof value === 'string') {
        return value.length > MAX_LOG_STRING_LENGTH
            ? `${value.slice(0, MAX_LOG_STRING_LENGTH)}...`
            : value
    }

    if (typeof value === 'bigint') {
        return value.toString()
    }

    if (typeof value === 'function' || typeof value === 'symbol') {
        return undefined
    }

    if (Array.isArray(value)) {
        if (depth >= MAX_LOG_PAYLOAD_DEPTH) {
            return '[MaxDepth]'
        }

        return value.map((item, index) => sanitizeLogPayload(
            item,
            { ...options, path: [...(options.path ?? []), String(index)] },
            depth + 1,
            seen
        ))
    }

    if (!value || typeof value !== 'object') {
        return value
    }

    if (seen.has(value)) {
        return '[Circular]'
    }

    if (depth >= MAX_LOG_PAYLOAD_DEPTH) {
        return '[MaxDepth]'
    }

    seen.add(value)
    const sanitized: Record<string, unknown> = {}

    for (const [key, item] of Object.entries(value)) {
        if (shouldOmitLogPayloadKey(key, options)) {
            continue
        }

        sanitized[key] = SENSITIVE_PARAM_KEYS.has(key.toLowerCase())
            ? '******'
            : sanitizeLogPayload(
                item,
                { ...options, path: [...(options.path ?? []), key] },
                depth + 1,
                seen
            )
    }

    seen.delete(value)
    return limitLogPayloadSize(sanitized)
}

/**
 * 将异常整理为可写入 request_result 的简洁错误响应。
 */
function toErrorResult(error: unknown) {
    const maybeError = error as any

    return sanitizeLogPayload({
        name: maybeError?.name,
        code: toErrorCode(error),
        message: error instanceof Error ? error.message : maybeError?.message ?? String(error)
    })
}

/**
 * 日志写入不能影响主业务流程，因此写库失败只打印错误，不继续向外抛出。
 */
async function ignoreLogError(action: () => Promise<unknown>, label: string) {
    try {
        await action()
    }
    catch (error) {
        console.error(`[${label} Write Failed]`, error)
    }
}

/**
 * 统一日志记录器。
 * 它会从 Context 中读取请求元数据和当前用户，调用方只传递要记录的业务事实即可。
 */
export function logRecorder(ctx: Context) {
    const requestInfo = () => getRequestInfo(ctx.event)
    const currentUser = () => ctx.user ?? ctx.session?.user ?? null

    return {
        /**
         * 写入登录日志。基础请求信息在方法内自动获取，业务侧只补充登录结果和少量业务字段。
         */
        async login(status: LogStatus, options: LoginLogOptions = {}) {
            const user = currentUser()
            const info = requestInfo()

            await ignoreLogError(
                () => sysLoginLogService(ctx).create({
                    id: null,
                    userId: options.userId ?? user?.id ?? null,
                    username: options.username ?? user?.username ?? 'unknown',
                    ip: info.ip,
                    location: options.location,
                    browser: info.browser,
                    os: info.os,
                    userAgent: info.userAgent,
                    loginType: options.loginType ?? 'password',
                    status,
                    remark: options.remark,
                    errorCode: options.errorCode,
                    traceId: info.traceId
                }),
                'LoginLog'
            )
        },

        /**
         * 登录成功快捷方法。
         */
        async loginSuccess(remark = 'login success') {
            await this.login(LOG_STATUS.success, { remark })
        },

        /**
         * 登录失败快捷方法，可传入登录表单中的 username 和异常对象。
         */
        async loginFailure(username?: string | null, remark = 'login failure', error?: unknown) {
            await this.login(LOG_STATUS.failure, { username, remark, errorCode: toErrorCode(error) })
        },

        /**
         * loginFailure 的别名，兼容较短调用。
         */
        async loginFail(username?: string | null, remark = 'login failure', error?: unknown) {
            await this.loginFailure(username, remark, error)
        },

        /**
         * loginFailure 的兼容别名，保留给已有调用方使用。
         */
        async loginFile(username?: string | null, remark = 'login failure', error?: unknown) {
            await this.loginFailure(username, remark, error)
        },

        /**
         * 写入系统操作日志。会自动补充用户、IP、浏览器、系统、traceId 等上下文信息。
         */
        async system(options: SystemLogOptions) {
            const user = currentUser()
            const info = requestInfo()
            const requestPath = options.requestPath ?? info.requestPath
            const trpcPath = options.trpcPath
            const payloadPolicy = resolveLogPayloadPolicy({ requestPath, trpcPath })

            await ignoreLogError(
                () => sysSystemLogService(ctx).create({
                    id: null,
                    userId: user?.id ?? null,
                    username: user?.username ?? null,
                    ip: info.ip,
                    userAgent: info.userAgent,
                    browser: info.browser,
                    os: info.os,
                    requestMethod: options.requestMethod ?? info.requestMethod,
                    requestPath,
                    trpcType: options.trpcType,
                    trpcPath,
                    durationMs: options.durationMs,
                    requestParams: applyLogPayloadPolicy(options.requestParams, payloadPolicy?.requestParamsOmitKeys),
                    requestResult: applyLogPayloadPolicy(options.requestResult, payloadPolicy?.requestResultOmitKeys),
                    errorCode: options.errorCode,
                    traceId: info.traceId,
                    level: options.level ?? LOG_LEVEL.info,
                    module: truncate(options.module, 50),
                    message: options.message,
                    trace: options.trace,
                    status: options.status ?? LOG_STATUS.success,
                    remark: options.remark
                }),
                'SystemLog'
            )
        },

        /**
         * debug 级别系统日志快捷方法。
         */
        async debug(message: string, options: SystemShortcutOptions = {}) {
            await this.system({ ...options, level: LOG_LEVEL.debug, status: LOG_STATUS.success, message })
        },

        /**
         * info 级别系统日志快捷方法。
         */
        async info(message: string, options: SystemShortcutOptions = {}) {
            await this.system({ ...options, level: LOG_LEVEL.info, status: LOG_STATUS.success, message })
        },

        /**
         * warn 级别系统日志快捷方法，默认仍按成功状态记录。
         */
        async warn(message: string, options: SystemShortcutOptions = {}) {
            await this.system({ ...options, level: LOG_LEVEL.warn, status: options.status ?? LOG_STATUS.success, message })
        },

        /**
         * error 级别系统日志快捷方法，默认按失败状态记录，并自动提取 trace/errorCode。
         */
        async error(message: string, error?: unknown, options: SystemShortcutOptions = {}) {
            await this.system({
                ...options,
                level: LOG_LEVEL.error,
                status: LOG_STATUS.failure,
                message,
                requestResult: options.requestResult,
                trace: options.trace ?? toTrace(error),
                errorCode: options.errorCode ?? toErrorCode(error)
            })
        },

        /**
         * 成功操作快捷方法，适合业务模块中手动记录关键动作。
         */
        async systemSuccess(module: string, message = 'operation success', options: SystemShortcutOptions = {}) {
            await this.system({ ...options, level: LOG_LEVEL.info, module, message, status: LOG_STATUS.success })
        },

        /**
         * 失败操作快捷方法，适合业务模块中捕获异常后记录失败详情。
         */
        async systemFailure(module: string, error?: unknown, message = 'operation failure', options: SystemShortcutOptions = {}) {
            await this.system({
                ...options,
                level: LOG_LEVEL.error,
                module,
                message,
                requestResult: options.requestResult ?? toErrorResult(error),
                trace: options.trace ?? toTrace(error),
                errorCode: options.errorCode ?? toErrorCode(error),
                status: LOG_STATUS.failure
            })
        }
    }
}
