import type { SysOssConfigDto } from '#shared/system/ossConfig'
import type { OssBody, OssProvider, OssUploadInput } from './types'
import {
    assertOk,
    createPublicUrl,
    createVerifyPayload,
    encodePathname,
    getBucket,
    getRequired,
    getResponseEtag,
    hmacSha1Hex,
    normalizeEndpoint,
    normalizeObjectKey,
    sha1Hex
} from './utils'

function createUrl(config: SysOssConfigDto, objectKey: string) {
    const endpoint = normalizeEndpoint(config.endpoint, config.isHttps ?? 1)
    const encodedKey = encodePathname(`/${objectKey}`).slice(1)

    if (endpoint) {
        return new URL(`${endpoint}/${getBucket(config)}/${encodedKey}`)
    }

    const region = getRequired(config.region, 'Region')
    return new URL(`https://${getBucket(config)}.cos.${region}.myqcloud.com/${encodedKey}`)
}

function createAuthorization(method: 'PUT' | 'DELETE', url: URL, config: SysOssConfigDto) {
    const accessKey = getRequired(config.accessKey, 'SecretId')
    const secretKey = getRequired(config.secretKey, 'SecretKey')
    const start = Math.floor(Date.now() / 1000)
    const end = start + 600
    const keyTime = `${start};${end}`
    const signKey = hmacSha1Hex(secretKey, keyTime)
    const pathname = encodePathname(url.pathname)
    const httpString = [
        method.toLowerCase(),
        pathname,
        '',
        `host=${url.host}`,
        ''
    ].join('\n')
    const stringToSign = [
        'sha1',
        keyTime,
        sha1Hex(httpString),
        ''
    ].join('\n')
    const signature = hmacSha1Hex(signKey, stringToSign)

    return [
        'q-sign-algorithm=sha1',
        `q-ak=${accessKey}`,
        `q-sign-time=${keyTime}`,
        `q-key-time=${keyTime}`,
        'q-header-list=host',
        'q-url-param-list=',
        `q-signature=${signature}`
    ].join('&')
}

async function request(method: 'PUT' | 'DELETE', config: SysOssConfigDto, objectKey: string, body: OssBody = new Uint8Array() as OssBody, contentType?: string) {
    const url = createUrl(config, objectKey)
    const headers: Record<string, string> = {
        Authorization: createAuthorization(method, url, config)
    }
    if (method === 'PUT' && contentType) {
        headers['content-type'] = contentType
    }

    const response = await fetch(url, {
        method,
        headers,
        body: method === 'PUT' ? body as unknown as BodyInit : undefined
    })
    await assertOk(response, `Tencent COS ${method}`)
    return { response, url }
}

export const tencentProvider: OssProvider = {
    service: 'tencent',
    async verify(config) {
        const objectKey = normalizeObjectKey(config.prefix)
        await this.upload(config, {
            objectKey,
            body: createVerifyPayload(),
            contentType: 'text/plain; charset=utf-8'
        })
        await this.delete(config, objectKey)
    },
    async upload(config: SysOssConfigDto, input: OssUploadInput) {
        const { response, url } = await request('PUT', config, input.objectKey, input.body, input.contentType)
        return {
            url: createPublicUrl(config, input.objectKey, url),
            etag: getResponseEtag(response)
        }
    },
    async delete(config: SysOssConfigDto, objectKey: string) {
        await request('DELETE', config, objectKey)
    }
}
