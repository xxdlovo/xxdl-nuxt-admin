import type { SysOssConfigDto } from '#shared/system/ossConfig'
import type { OssBody, OssProvider, OssUploadInput } from './types'
import {
    assertOk,
    createVerifyPayload,
    createPublicUrl,
    encodePathname,
    getBucket,
    getRequired,
    getResponseEtag,
    hmacSha1Base64,
    normalizeEndpoint,
    normalizeObjectKey
} from './utils'

function createUrl(config: SysOssConfigDto, objectKey: string) {
    const endpoint = normalizeEndpoint(config.endpoint, config.isHttps ?? 1)
    if (!endpoint) {
        throw new Error('Endpoint不能为空')
    }

    const url = new URL(endpoint)
    const bucket = getBucket(config)
    const host = resolveAliyunHost(url.host, bucket)
    return new URL(`${url.protocol}//${host}/${encodePathname(objectKey)}`)
}

function resolveAliyunHost(host: string, bucket: string) {
    if (!host.endsWith('.aliyuncs.com')) {
        return host
    }

    if (host.startsWith(`${bucket}.`)) {
        return host
    }

    return `${bucket}.${host}`
}

function createHeaders(method: 'PUT' | 'DELETE', config: SysOssConfigDto, objectKey: string, contentType = '') {
    const accessKey = getRequired(config.accessKey, 'AccessKey')
    const secretKey = getRequired(config.secretKey, 'SecretKey')
    const date = new Date().toUTCString()
    const resource = `/${getBucket(config)}/${objectKey}`
    const stringToSign = [
        method,
        '',
        contentType,
        date,
        resource
    ].join('\n')

    return {
        Authorization: `OSS ${accessKey}:${hmacSha1Base64(secretKey, stringToSign)}`,
        Date: date,
        ...(contentType ? { 'content-type': contentType } : {})
    }
}

async function request(method: 'PUT' | 'DELETE', config: SysOssConfigDto, objectKey: string, body: OssBody = new Uint8Array() as OssBody, contentType?: string) {
    const url = createUrl(config, objectKey)
    const headers = createHeaders(method, config, objectKey, method === 'PUT' ? (contentType || 'application/octet-stream') : '')
    const response = await fetch(url, {
        method,
        headers,
        body: method === 'PUT' ? body as unknown as BodyInit : undefined
    })
    await assertOk(response, `Aliyun OSS ${method}`)
    return { response, url }
}

export const aliyunProvider: OssProvider = {
    service: 'aliyun',
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
