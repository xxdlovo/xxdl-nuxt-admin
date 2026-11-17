import type { H3Event } from 'h3'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

/**
 * “记住我”的凭据存储。
 *
 * 不把密码写进 localStorage，而是用 NUXT_SESSION_PASSWORD 派生的 AES-256-GCM
 * 密钥加密后放进 HttpOnly Cookie；登录页通过同源接口读取并回填。
 *
 * 这是“预填密码”能做到的相对安全方案，但密码最终仍会回到浏览器内存，
 * 因此只适合内部后台；对公网高安全场景建议改用长期会话/自动登录令牌。
 */

export const REMEMBERED_LOGIN_COOKIE = 'xxdl_remembered_login'
export const REMEMBERED_LOGIN_MAX_AGE = 30 * 24 * 60 * 60

type RuntimeConfig = {
    session?: {
        password?: string
        cookie?: {
            secure?: boolean
        }
    }
}

export type RememberedLogin = {
    username: string
    password: string
}

const keyCache = new Map<string, Buffer>()

function encryptionKey(secret: string) {
    const cached = keyCache.get(secret)
    if (cached) {
        return cached
    }

    const key = scryptSync(secret, 'xxdl-remembered-login', 32)
    keyCache.set(secret, key)
    return key
}

function runtimeConfig(event: H3Event) {
    return useRuntimeConfig(event) as RuntimeConfig
}

function secret(event: H3Event) {
    return runtimeConfig(event).session?.password || ''
}

function cookieSecure(event: H3Event) {
    return runtimeConfig(event).session?.cookie?.secure === true
}

export function setRememberedLogin(event: H3Event, value: RememberedLogin) {
    const password = secret(event)
    if (!password) {
        return
    }

    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', encryptionKey(password), iv)
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(value), 'utf8'),
        cipher.final(),
    ])
    const tag = cipher.getAuthTag()
    const token = [
        'v1',
        iv.toString('base64url'),
        tag.toString('base64url'),
        encrypted.toString('base64url'),
    ].join('.')

    setCookie(event, REMEMBERED_LOGIN_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: cookieSecure(event),
        path: '/',
        maxAge: REMEMBERED_LOGIN_MAX_AGE,
    })
}

export function readRememberedLogin(event: H3Event): RememberedLogin | null {
    const password = secret(event)
    const token = getCookie(event, REMEMBERED_LOGIN_COOKIE)
    if (!password || !token) {
        return null
    }

    try {
        const [version, ivText, tagText, encryptedText] = token.split('.')
        if (version !== 'v1' || !ivText || !tagText || !encryptedText) {
            return null
        }

        const decipher = createDecipheriv(
            'aes-256-gcm',
            encryptionKey(password),
            Buffer.from(ivText, 'base64url'),
        )
        decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(encryptedText, 'base64url')),
            decipher.final(),
        ]).toString('utf8')

        const value = JSON.parse(decrypted) as Partial<RememberedLogin>
        if (typeof value.username !== 'string' || typeof value.password !== 'string') {
            return null
        }

        return {
            username: value.username,
            password: value.password,
        }
    }
    catch {
        return null
    }
}

export function clearRememberedLogin(event: H3Event) {
    setCookie(event, REMEMBERED_LOGIN_COOKIE, '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: cookieSecure(event),
        path: '/',
        maxAge: 0,
    })
}
