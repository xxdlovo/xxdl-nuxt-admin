import type { Context } from '#admin/server/trpc/context'
import { systemRateLimitEnum } from '#admin/shared/constants/business'
import { sysConfigRepo } from '#admin/server/sys-router/config/SysConfigRepo'

/**
 * 全局限流配置。
 *
 * 阈值存在 sys_config 里，可在「参数配置」页面随时修改；中间件每个请求都会用到，
 * 因此这里做进程内缓存（60 秒），避免每次请求都查库。
 *
 * 配置缺失或读取失败时回落到内置默认值（fail-open）：限流是为了防御刷接口，
 * 不应该因为配置表不可用而让业务接口整体 500。
 */
export type RateLimitSettings = {
    enabled: boolean
    queryPerMin: number
    mutationPerMin: number
}

const CACHE_TTL_MS = 60 * 1000

let cachedSettings: RateLimitSettings | null = null
let cacheExpiresAt = 0

function parseBoolean(value: string | null | undefined, fallback: boolean) {
    if (value === null || value === undefined || value === '') {
        return fallback
    }

    return value === 'true' || value === '1'
}

function parseLimit(value: string | null | undefined, fallback: number) {
    if (value === null || value === undefined || value === '') {
        return fallback
    }

    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) {
        return fallback
    }

    return Math.floor(parsed)
}

function defaultSettings(): RateLimitSettings {
    return {
        enabled: systemRateLimitEnum.defaultEnabled === 'true',
        queryPerMin: systemRateLimitEnum.defaultQueryPerMin,
        mutationPerMin: systemRateLimitEnum.defaultMutationPerMin
    }
}

/**
 * 读取全局限流配置（带 60 秒缓存）。
 *
 * 配置修改后最多 60 秒生效，文档中已说明该延迟。
 */
export async function getRateLimitSettings(ctx: Context): Promise<RateLimitSettings> {
    const now = Date.now()
    if (cachedSettings && cacheExpiresAt > now) {
        return cachedSettings
    }

    try {
        const rows = await sysConfigRepo(ctx).getByKeys([
            systemRateLimitEnum.enabledKey,
            systemRateLimitEnum.queryPerMinKey,
            systemRateLimitEnum.mutationPerMinKey
        ])

        const map = new Map(rows.map(row => [row.configKey, row.configValue]))
        const fallback = defaultSettings()
        const settings: RateLimitSettings = {
            enabled: parseBoolean(map.get(systemRateLimitEnum.enabledKey), fallback.enabled),
            queryPerMin: parseLimit(map.get(systemRateLimitEnum.queryPerMinKey), fallback.queryPerMin),
            mutationPerMin: parseLimit(map.get(systemRateLimitEnum.mutationPerMinKey), fallback.mutationPerMin)
        }

        cachedSettings = settings
        cacheExpiresAt = now + CACHE_TTL_MS
        return settings
    }
    catch (error) {
        // fail-open：配置读取失败时按默认值限流，避免中间件把请求全部拦死。
        console.warn('[rate-limit] read system config failed, fallback to defaults', error)
        const fallback = defaultSettings()
        cachedSettings = fallback
        cacheExpiresAt = now + CACHE_TTL_MS
        return fallback
    }
}

/** 清空缓存（参数配置更新后可由调用方主动失效；目前依赖 60 秒 TTL）。 */
export function resetRateLimitSettingsCache() {
    cachedSettings = null
    cacheExpiresAt = 0
}
