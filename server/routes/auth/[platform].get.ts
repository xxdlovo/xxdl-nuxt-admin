import type { H3Event } from 'h3'
import { deleteCookie, getCookie, getQuery, getRequestURL, getRouterParam, sendRedirect, setCookie } from 'h3'
import { createContext } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import { logRecorder } from '#server/sys-router/systemLog/LogRecorderService'
import { sysOauthAccountService } from '#server/sys-router/oauthAccount/SysOauthAccountService'
import { sysOauthConfigService } from '#server/sys-router/oauthConfig/SysOauthConfigService'
import { OauthExtraSchema, type OauthExtra, type SysOauthConfigDto } from '#shared/system/oauthConfig'

/** 登录成功后落地的后台首页 */
const SUCCESS_REDIRECT = '/system/home'
/** 登录失败统一回登录页，通过 oauthError 查询参数携带 i18n key 或错误信息 */
const LOGIN_PATH = '/login'

const SUPPORTED_PLATFORMS = ['github', 'google', 'gitlab', 'gitee', 'microsoft', 'linuxdo'] as const
type SupportedPlatform = typeof SUPPORTED_PLATFORMS[number]

/** 各平台回调返回的资料结构不同，这里统一归一化 */
type NormalizedProfile = {
    providerUserId: string
    login: string | null
    email: string | null
    nickname: string | null
    avatar: string | null
    raw: unknown
}

/** 平台标识统一按小写比对，避免平台列填成 GITHUB 这类写法时匹配不上 */
function normalizePlatform(value: string) {
    return value.trim().toLowerCase()
}

function isSupported(platform: string): platform is SupportedPlatform {
    return (SUPPORTED_PLATFORMS as readonly string[]).includes(platform)
}

function firstNonEmpty(...values: Array<unknown>): string | null {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim()
        }
        if (typeof value === 'number') {
            return String(value)
        }
    }
    return null
}

function toRedirect(path: string, errorKey?: string) {
    if (!errorKey) {
        return path
    }
    return `${path}?oauthError=${encodeURIComponent(errorKey)}`
}

function toI18nKey(error: unknown) {
    if (error instanceof AppError) {
        return error.i18nKey
    }
    if (error instanceof Error) {
        return error.message
    }
    return 'auth.oauthFailed'
}

/**
 * 按 platform 从 sys_oauth_config 组装 nuxt-auth-utils 的 config。
 *
 * 关键点：只传入配置行中真实存在的字段。handler 内部为
 * `defu(config, useRuntimeConfig(event).oauth?.[platform], 默认值)`，
 * 传入的 config 优先级最高；若把空值也传进去，会遮蔽
 * NUXT_OAUTH_<PLATFORM>_CLIENT_ID 这类环境变量兜底配置。
 */
function buildHandlerConfig(platform: SupportedPlatform, cfg: SysOauthConfigDto, extra: OauthExtra) {
    const config: Record<string, unknown> = {}

    if (cfg.clientId) config.clientId = cfg.clientId
    if (cfg.clientSecret) config.clientSecret = cfg.clientSecret
    if (cfg.redirectUrl) config.redirectURL = cfg.redirectUrl
    if (extra.authorizationURL) config.authorizationURL = extra.authorizationURL
    if (extra.tokenURL) config.tokenURL = extra.tokenURL
    if (extra.apiURL) config.apiURL = extra.apiURL
    if (extra.authorizationParams) config.authorizationParams = extra.authorizationParams

    // GitHub 默认不返回邮箱，必须显式要求 user:email 范围（模块会自动补 scope）
    if (platform === 'github') config.emailRequired = true

    return config
}

/** 取配置行里指定字段名的值，未配置时回退到通用字段名 */
function pickField(user: Record<string, unknown>, field: string | null | undefined, fallback: string) {
    if (field && user[field] !== undefined) {
        return user[field]
    }
    return user[fallback]
}

/** LinuxDo Connect 的默认值，端点均可用配置行 extra 覆盖 */
const LINUXDO_DEFAULTS = {
    authorizationURL: 'https://connect.linux.do/oauth2/authorize',
    tokenURL: 'https://connect.linux.do/oauth2/token',
    apiURL: 'https://connect.linux.do/api/user',
    /** 官方接入文档的授权参数固定带 scope=user */
    scope: 'user',
    /** Discourse 系的 avatar_template 是相对路径，需要拼站点域名 */
    avatarBaseURL: 'https://linux.do'
} as const

/** 授权阶段写入的 state cookie，回调比对后立即删除 */
const LINUXDO_STATE_COOKIE = 'oauth_linuxdo_state'
/** state 有效期（秒） */
const LINUXDO_STATE_MAX_AGE = 600
/** avatar_template 里 {size} 占位符的替换值 */
const LINUXDO_AVATAR_SIZE = 120

/**
 * LinuxDo Connect 走标准 OAuth2 授权码流程。
 *
 * nuxt-auth-utils 没有内置 LinuxDo 的 handler，因此这里自己实现两段式跳转：
 * 1. 首次访问（无 code）：生成 state 写 cookie，跳转到授权端点；
 * 2. 回调（带 code）：校验 state → 用 code 换 access_token → 拉用户信息 → 交给共用的 handlers。
 *
 * 三个端点默认取 LinuxDo 官方地址，可用配置行 `extra` 里的
 * authorizationURL / tokenURL / apiURL 覆盖（与其它平台的覆盖方式一致）。
 */
async function handleLinuxDo(
    event: H3Event,
    options: {
        clientId: string
        clientSecret: string
        redirectURL: string
        scope?: string | null
        extra: OauthExtra
        onSuccess: (event: H3Event, result: { user: unknown }) => Promise<unknown>
        onError: (event: H3Event, error: unknown) => Promise<unknown>
    }
) {
    const query = getQuery(event)
    const authorizationURL = options.extra.authorizationURL || LINUXDO_DEFAULTS.authorizationURL
    const tokenURL = options.extra.tokenURL || LINUXDO_DEFAULTS.tokenURL
    const apiURL = options.extra.apiURL || LINUXDO_DEFAULTS.apiURL

    // 第一段：还没有 code，生成 state 并跳去授权页
    if (typeof query.code !== 'string' || !query.code) {
        const state = crypto.randomUUID()

        setCookie(event, LINUXDO_STATE_COOKIE, state, {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: LINUXDO_STATE_MAX_AGE
        })

        const target = new URL(authorizationURL)
        target.searchParams.set('client_id', options.clientId)
        target.searchParams.set('redirect_uri', options.redirectURL)
        target.searchParams.set('response_type', 'code')
        target.searchParams.set('state', state)

        // 官方接入文档固定带 scope=user；配置行显式填了 scope 时以配置为准
        target.searchParams.set('scope', options.scope || LINUXDO_DEFAULTS.scope)

        for (const [key, value] of Object.entries(options.extra.authorizationParams ?? {})) {
            target.searchParams.set(key, value)
        }

        return sendRedirect(event, target.toString())
    }

    // 第二段：回调，先比对 state（防 CSRF）
    const expectedState = getCookie(event, LINUXDO_STATE_COOKIE)
    deleteCookie(event, LINUXDO_STATE_COOKIE, { path: '/' })

    if (!expectedState || expectedState !== query.state) {
        return options.onError(event, new AppError('auth.oauthStateMismatch'))
    }

    try {
        const token = await $fetch<{ access_token?: string }>(tokenURL, {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: query.code,
                client_id: options.clientId,
                client_secret: options.clientSecret,
                redirect_uri: options.redirectURL
            }).toString()
        })

        if (!token?.access_token) {
            throw new AppError('auth.oauthFailed')
        }

        const user = await $fetch<Record<string, unknown>>(apiURL, {
            headers: {
                accept: 'application/json',
                authorization: `Bearer ${token.access_token}`
            }
        })

        // Discourse 系返回的 avatar_template 是相对路径 + {size} 占位符，
        // 这里补成可直接展示的 URL；通用 normalize 会优先读取 avatar_url。
        const template = typeof user.avatar_template === 'string' ? user.avatar_template : ''
        if (template) {
            const filled = template.replace('{size}', String(LINUXDO_AVATAR_SIZE))
            const base = options.extra.avatarBaseURL || LINUXDO_DEFAULTS.avatarBaseURL
            user.avatar_url = filled.startsWith('http') ? filled : `${base}${filled}`
        }

        return options.onSuccess(event, { user })
    }
    catch (error) {
        return options.onError(event, error)
    }
}

export default defineEventHandler(async (event: H3Event) => {
    const rawPlatform = getRouterParam(event, 'platform')
    const normalizedPlatform = rawPlatform ? normalizePlatform(rawPlatform) : ''
    const ctx = await createContext(event)

    if (!normalizedPlatform || !isSupported(normalizedPlatform)) {
        return sendRedirect(event, toRedirect(LOGIN_PATH, 'auth.oauthPlatformUnsupported'))
    }

    // 用归一化后的小写值查配置，兼容平台列被填成 GITHUB 等大小写不一致的情况
    const platform = normalizedPlatform
    const cfg = await sysOauthConfigService(ctx).getEnabledByPlatform(platform)

    if (!cfg) {
        await logRecorder(ctx).loginFailure(null, `oauth platform disabled: ${platform}`)
        return sendRedirect(event, toRedirect(LOGIN_PATH, 'auth.oauthPlatformDisabled'))
    }

    if (!cfg.clientId || !cfg.clientSecret) {
        await logRecorder(ctx).loginFailure(null, `oauth platform misconfigured: ${platform}`)
        return sendRedirect(event, toRedirect(LOGIN_PATH, 'auth.oauthMisconfigured'))
    }

    const extra = OauthExtraSchema.safeParse(cfg.extra).data ?? {}
    const handlerConfig = buildHandlerConfig(platform, cfg, extra)

    /** 把平台原始资料映射成统一结构 */
    const normalize = (user: Record<string, unknown>): NormalizedProfile => ({
        providerUserId: firstNonEmpty(user.id, user.sub, user.openid) ?? '',
        login: firstNonEmpty(
            pickField(user, extra.loginField, 'login'),
            user.username,
            user.preferred_username,
            user.nickname
        ),
        email: firstNonEmpty(pickField(user, extra.emailField, 'email'), user.mail),
        nickname: firstNonEmpty(user.name, user.nickname, user.login, user.username),
        avatar: firstNonEmpty(
            pickField(user, extra.avatarField, 'avatar_url'),
            user.picture,
            user.avatar
        ),
        raw: user
    })

    /** 各平台共用的业务处理：建号/绑定 → 建 session → 记日志 */
    const handlers = {
        onSuccess: async (successEvent: H3Event, result: { user: any }) => {
            const successCtx = await createContext(successEvent)
            const normalized = normalize((result?.user ?? {}) as Record<string, unknown>)

            try {
                if (!normalized.providerUserId) {
                    throw new AppError('auth.oauthProfileInvalid')
                }

                const sessionUser = await sysOauthAccountService(successCtx).loginByOAuth({
                    provider: platform,
                    providerUserId: normalized.providerUserId,
                    login: normalized.login,
                    email: normalized.email,
                    nickname: normalized.nickname,
                    avatar: normalized.avatar,
                    raw: normalized.raw,
                    defaultRoleId: cfg.defaultRoleId ?? null
                })

                await setUserSession(successEvent, {
                    user: sessionUser,
                    loggedInAt: new Date().toISOString()
                })

                await logRecorder(successCtx).loginSuccess()

                return sendRedirect(successEvent, SUCCESS_REDIRECT)
            }
            catch (error) {
                await logRecorder(successCtx).loginFailure(
                    normalized.login,
                    'oauth login failure',
                    error
                )
                return sendRedirect(successEvent, toRedirect(LOGIN_PATH, toI18nKey(error)))
            }
        },
        onError: async (errorEvent: H3Event, error: any) => {
            const errorCtx = await createContext(errorEvent)
            await logRecorder(errorCtx).loginFailure(null, 'oauth callback failure', error)
            return sendRedirect(
                errorEvent,
                toRedirect(LOGIN_PATH, error?.message || 'auth.oauthFailed')
            )
        }
    }

    // 各平台 handler 由 nuxt-auth-utils 经 addServerImportsDir 自动导入；
    // 该包只导出主入口，无法按子路径 import，因此这里显式映射平台。
    switch (platform) {
        case 'github':
            return defineOAuthGitHubEventHandler({ config: handlerConfig, ...handlers })(event)
        case 'google':
            return defineOAuthGoogleEventHandler({ config: handlerConfig, ...handlers })(event)
        case 'gitlab':
            return defineOAuthGitLabEventHandler({ config: handlerConfig, ...handlers })(event)
        case 'gitee':
            return defineOAuthGiteaEventHandler({ config: handlerConfig, ...handlers })(event)
        case 'microsoft':
            return defineOAuthMicrosoftEventHandler({ config: handlerConfig, ...handlers })(event)
        case 'linuxdo':
            return handleLinuxDo(event, {
                clientId: cfg.clientId,
                clientSecret: cfg.clientSecret,
                // 未配置回调地址时按当前请求推导，与 nuxt-auth-utils 的默认行为保持一致
                redirectURL: cfg.redirectUrl || new URL('/auth/linuxdo', getRequestURL(event)).toString(),
                scope: cfg.scope,
                extra,
                onSuccess: handlers.onSuccess,
                onError: handlers.onError
            })
        default:
            return sendRedirect(event, toRedirect(LOGIN_PATH, 'auth.oauthPlatformUnsupported'))
    }
})
