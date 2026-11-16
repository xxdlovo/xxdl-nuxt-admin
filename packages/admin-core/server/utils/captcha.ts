import type { H3Event } from 'h3'
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { deleteCookie, getCookie, setCookie } from 'h3'

/**
 * 登录图形验证码。
 *
 * 不引入 svg-captcha 依赖：
 * - SVG 由这里直接拼出来，4 位字符 + 干扰线/噪点 + 随机旋转；
 * - 答案不落库、不落 Nitro storage，而是把「过期时间 + 答案的 HMAC」写进
 *   httpOnly Cookie，登录时用用户输入重新计算 HMAC 比对。
 *
 * 这样验证码天然支持多实例/Serverless，不需要 Redis 或共享缓存。
 */

export const CAPTCHA_COOKIE = 'nuxt-captcha'

/** 验证码有效期（秒） */
export const CAPTCHA_TTL_SECONDS = 120

/** 去掉 0/O、1/I/L 等易混字符 */
const CAPTCHA_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

type CaptchaRuntimeConfig = {
    session?: {
        password?: string
        cookie?: {
            secure?: boolean
        }
    }
}

function getSecret(event: H3Event) {
    const config = useRuntimeConfig(event) as CaptchaRuntimeConfig
    const secret = config.session?.password
    if (!secret) {
        // 项目要求必须配置 NUXT_SESSION_PASSWORD；缺失时验证码无法安全签发。
        throw new Error('NUXT_SESSION_PASSWORD is required for captcha signing')
    }

    return secret
}

function sign(payload: string, secret: string) {
    return createHmac('sha256', secret).update(payload).digest('base64url')
}

function randomCode(length = 4) {
    return Array.from({ length }, () => CAPTCHA_CHARS[randomInt(0, CAPTCHA_CHARS.length)]).join('')
}

function escapeXml(value: string) {
    return value.replace(/[<>&'"]/g, (char) => {
        switch (char) {
            case '<': return '&lt;'
            case '>': return '&gt;'
            case '&': return '&amp;'
            case '\'': return '&apos;'
            default: return '&quot;'
        }
    })
}

/**
 * 生成验证码 SVG，并写入签名 Cookie。
 */
export function createCaptcha(event: H3Event) {
    const code = randomCode()
    const expiresAt = Date.now() + CAPTCHA_TTL_SECONDS * 1000
    const payload = `${expiresAt}:${code}`
    const token = `${expiresAt}.${sign(payload, getSecret(event))}`

    const config = useRuntimeConfig(event) as CaptchaRuntimeConfig
    setCookie(event, CAPTCHA_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: CAPTCHA_TTL_SECONDS,
        secure: config.session?.cookie?.secure === true,
    })

    return buildSvg(code)
}

/**
 * 生成一张带干扰的 SVG。
 *
 * 这里刻意不做路径级字符扭曲（那需要字体轮廓），只做位置/旋转/颜色/线条扰动，
 * 对后台管理系统的登录防护足够，且 SVG 体积极小。
 */
function buildSvg(code: string) {
    const width = 120
    const height = 40
    const colors = ['#2563eb', '#0f766e', '#b45309', '#7c3aed', '#be123c']

    const chars = code.split('').map((char, index) => {
        const x = 12 + index * 25 + randomInt(-2, 3)
        const y = 27 + randomInt(-2, 3)
        const rotate = randomInt(-18, 19)
        const color = colors[randomInt(0, colors.length)]
        return `<text x="${x}" y="${y}" fill="${color}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="${randomInt(24, 29)}" font-weight="700" transform="rotate(${rotate} ${x} ${y})">${escapeXml(char)}</text>`
    }).join('')

    const lines = Array.from({ length: 4 }, () => {
        const x1 = randomInt(0, width)
        const y1 = randomInt(0, height)
        const x2 = randomInt(0, width)
        const y2 = randomInt(0, height)
        const color = colors[randomInt(0, colors.length)]
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${randomInt(1, 3)}" opacity="0.35" />`
    }).join('')

    const dots = Array.from({ length: 24 }, () => {
        const cx = randomInt(0, width)
        const cy = randomInt(0, height)
        const color = colors[randomInt(0, colors.length)]
        return `<circle cx="${cx}" cy="${cy}" r="${randomInt(1, 3)}" fill="${color}" opacity="0.35" />`
    }).join('')

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="captcha"><rect width="100%" height="100%" fill="#f8fafc" />${dots}${lines}${chars}</svg>`
}

/**
 * 校验用户输入的验证码。
 *
 * - 无论成功失败都删除 Cookie，避免同一个验证码被重复提交；
 * - 使用 timingSafeEqual，避免按字符比较带来的时间侧信道。
 */
export function verifyCaptcha(event: H3Event, input?: string | null) {
    const token = getCookie(event, CAPTCHA_COOKIE)
    deleteCookie(event, CAPTCHA_COOKIE, { path: '/' })

    if (!token || !input) {
        return false
    }

    const [expiresAtText, signature] = token.split('.')
    const expiresAt = Number(expiresAtText)
    if (!expiresAtText || !signature || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
        return false
    }

    const expected = sign(`${expiresAtText}:${input.trim().toUpperCase()}`, getSecret(event))
    const actualBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expected)

    if (actualBuffer.length !== expectedBuffer.length) {
        return false
    }

    return timingSafeEqual(actualBuffer, expectedBuffer)
}

/** 主动清空验证码 Cookie（例如登录成功后）。 */
export function clearCaptcha(event: H3Event) {
    deleteCookie(event, CAPTCHA_COOKIE, { path: '/' })
}
