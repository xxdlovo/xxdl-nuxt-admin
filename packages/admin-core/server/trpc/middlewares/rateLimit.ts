import { getRequestIP } from 'h3'
import { AppError } from '#admin/server/utils/appError'
import { getRateLimitSettings } from '#admin/server/utils/rateLimitConfig'

/**
 * 进程内限流与防重复提交。
 *
 * 不引入 Redis：多实例部署时每个实例独立计数。
 * 限流分两层：
 * - 全局默认：所有经过 `proc()` 的接口，query / mutation 分别按系统配置限流；
 * - 显式覆盖：登录、手动执行任务等高危接口在声明处写死更严的阈值。
 */

type Bucket = {
    count: number
    resetAt: number
}

/** 显式限流参数：limit 次 / windowMs 毫秒，scope 用于区分计数桶。 */
export type RateLimitOption = {
    limit: number
    windowMs: number
    scope?: string
}

const repeatWindow = new Map<string, number>()
const rateBuckets = new Map<string, Bucket>()

function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value)
    }

    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`
    }

    const entries = Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)

    return `{${entries.join(',')}}`
}

function identity(opts: any) {
    const userId = opts.ctx?.user?.id

    if (userId) {
        return `user:${userId}`
    }

    try {
        return `ip:${getRequestIP(opts.ctx?.event, { xForwardedFor: true }) || 'unknown'}`
    }
    catch {
        return 'anon'
    }
}

function cleanup(now: number) {
    if (repeatWindow.size > 5000) {
        for (const [key, expiresAt] of repeatWindow) {
            if (expiresAt <= now) {
                repeatWindow.delete(key)
            }
        }
    }

    if (rateBuckets.size > 5000) {
        for (const [key, bucket] of rateBuckets) {
            if (bucket.resetAt <= now) {
                rateBuckets.delete(key)
            }
        }
    }
}

export function repeatSubmitMiddleware(enabled = false, windowMs = 5000) {
    return async (opts: any) => {
        if (!enabled) {
            return opts.next()
        }

        const input = await opts.getRawInput()
        const key = `${identity(opts)}:${opts.path}:${stableStringify(input)}`
        const now = Date.now()
        const expiresAt = repeatWindow.get(key)

        if (expiresAt && expiresAt > now) {
            throw new AppError('system.repeatSubmit')
        }

        repeatWindow.set(key, now + windowMs)
        cleanup(now)
        return opts.next()
    }
}

/**
 * 计算本次请求使用的限额。
 *
 * 优先级：显式参数 > 系统配置里的全局默认 > 不限流。
 * 显式传 `false` 表示该接口完全跳过限流（用于明确不需要限制的接口）。
 */
async function resolveBucket(explicit: RateLimitOption | false | undefined, opts: any): Promise<RateLimitOption | null> {
    if (explicit === false) {
        return null
    }

    if (explicit) {
        return {
            limit: explicit.limit,
            windowMs: explicit.windowMs,
            scope: explicit.scope || opts.path
        }
    }

    const type = (opts as { type?: string }).type
    if (type !== 'query' && type !== 'mutation') {
        return null
    }

    const ctx = opts.ctx
    if (!ctx) {
        return null
    }

    const settings = await getRateLimitSettings(ctx)
    if (!settings.enabled) {
        return null
    }

    const limit = type === 'query' ? settings.queryPerMin : settings.mutationPerMin
    if (!limit || limit <= 0) {
        return null
    }

    return {
        limit,
        windowMs: 60_000,
        scope: `global-${type}`
    }
}

export function rateLimitMiddleware(explicit?: RateLimitOption | false) {
    return async (opts: any) => {
        const bucketOption = await resolveBucket(explicit, opts)
        if (!bucketOption) {
            return opts.next()
        }

        const key = `${identity(opts)}:${bucketOption.scope}`
        const now = Date.now()
        const bucket = rateBuckets.get(key)

        if (!bucket || bucket.resetAt <= now) {
            rateBuckets.set(key, { count: 1, resetAt: now + bucketOption.windowMs })
            cleanup(now)
            return opts.next()
        }

        if (bucket.count >= bucketOption.limit) {
            throw new AppError('system.rateLimited')
        }

        bucket.count += 1
        return opts.next()
    }
}
