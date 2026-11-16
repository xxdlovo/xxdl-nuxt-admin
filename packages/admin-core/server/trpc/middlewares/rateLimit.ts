import { getRequestIP } from 'h3'
import { AppError } from '#admin/server/utils/appError'

/**
 * 进程内限流与防重复提交。
 *
 * 不引入 Redis：多实例部署时每个实例独立计数。
 * 只用于高危写操作与登录，不做全局默认限流。
 */

type Bucket = {
    count: number
    resetAt: number
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

export function rateLimitMiddleware(options?: { limit: number, windowMs: number, scope?: string }) {
    return async (opts: any) => {
        if (!options) {
            return opts.next()
        }

        const key = `${identity(opts)}:${options.scope || opts.path}`
        const now = Date.now()
        const bucket = rateBuckets.get(key)

        if (!bucket || bucket.resetAt <= now) {
            rateBuckets.set(key, { count: 1, resetAt: now + options.windowMs })
            cleanup(now)
            return opts.next()
        }

        if (bucket.count >= options.limit) {
            throw new AppError('system.rateLimited')
        }

        bucket.count += 1
        return opts.next()
    }
}
