import type { H3Event } from 'h3'
import { getRouterParam, sendRedirect } from 'h3'
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

const SUPPORTED_PLATFORMS = ['github', 'google', 'gitlab', 'gitee', 'microsoft'] as const
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
        default:
            return sendRedirect(event, toRedirect(LOGIN_PATH, 'auth.oauthPlatformUnsupported'))
    }
})
