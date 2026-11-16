import { setHeader } from 'h3'
import { createCaptcha } from '#admin/server/utils/captcha'
import { getRequestInfo } from '#admin/server/utils/requestInfo'

/**
 * 登录图形验证码。
 *
 * GET /api/captcha
 * 返回 SVG，同时写入一个 httpOnly 的签名 Cookie；登录时由 AuthService 校验。
 */

const WINDOW_MS = 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 30

type RateLimitEntry = {
    count: number
    resetAt: number
}

// 单实例内存限流：验证码本身很短命，多实例下最坏情况只是每个实例各放行一轮。
const rateLimit = new Map<string, RateLimitEntry>()

function isAllowed(ip: string) {
    const now = Date.now()
    const current = rateLimit.get(ip)

    if (!current || current.resetAt <= now) {
        rateLimit.set(ip, { count: 1, resetAt: now + WINDOW_MS })
        return true
    }

    if (current.count >= MAX_REQUESTS_PER_WINDOW) {
        return false
    }

    current.count += 1
    return true
}

export default defineEventHandler((event) => {
    const { ip } = getRequestInfo(event)

    if (!isAllowed(ip)) {
        throw createError({
            statusCode: 429,
            statusMessage: 'Too Many Requests'
        })
    }

    setHeader(event, 'Content-Type', 'image/svg+xml; charset=utf-8')
    setHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    setHeader(event, 'Pragma', 'no-cache')

    return createCaptcha(event)
})
