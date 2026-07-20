import { createHash, createHmac } from 'node:crypto'
import type { SysOssConfigDto } from '#shared/system/ossConfig'
import { randomUuid } from '#shared/utils/uuid'
import type { OssBody } from './types'

export function getRequired(value: string | null | undefined, label: string) {
    if (!value) {
        throw new Error(`${label}不能为空`)
    }
    return value
}

export function normalizeEndpoint(endpoint?: string | null, isHttps = 1) {
    const trimmed = endpoint?.trim()
    if (!trimmed) {
        return ''
    }
    const protocolEndpoint = /^https?:\/\//i.test(trimmed)
        ? trimmed
        : `${isHttps === 1 ? 'https' : 'http'}://${trimmed}`
    return protocolEndpoint.replace(/\/+$/, '')
}

export function normalizeObjectKey(prefix?: string | null) {
    const safePrefix = prefix
        ?.split('/')
        .filter(segment => segment && segment !== '.' && segment !== '..')
        .join('/')
    return [safePrefix, 'oss-verify', `${randomUuid()}.txt`]
        .filter(Boolean)
        .join('/')
}

export function createVerifyPayload() {
    return new Uint8Array(Buffer.from(`xxdl-nuxt-admin oss verify ${new Date().toISOString()}\n`, 'utf8')) as OssBody
}

export function encodePathname(pathname: string) {
    return pathname
        .split('/')
        .map(segment => encodeURIComponent(decodeURIComponent(segment)))
        .join('/')
}

export function sha1Hex(data: string) {
    return createHash('sha1').update(data).digest('hex')
}

export function sha256Hex(data: string | OssBody) {
    return createHash('sha256').update(data).digest('hex')
}

export function hmacSha1Base64(key: string | Uint8Array, data: string) {
    return createHmac('sha1', key).update(data).digest('base64')
}

export function hmacSha1Hex(key: string | Uint8Array, data: string) {
    return createHmac('sha1', key).update(data).digest('hex')
}

export function hmacSha256(key: string | Uint8Array, data: string) {
    return createHmac('sha256', key).update(data).digest()
}

export function hmacSha256Hex(key: string | Uint8Array, data: string) {
    return createHmac('sha256', key).update(data).digest('hex')
}

export async function assertOk(response: Response, action: string) {
    if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`${action} ${response.status} ${response.statusText}${text ? `: ${text.slice(0, 300)}` : ''}`)
    }
}

export function getBucket(config: SysOssConfigDto) {
    return getRequired(config.bucketName, 'Bucket')
}
