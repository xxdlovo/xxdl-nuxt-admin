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
    hmacSha256,
    hmacSha256Hex,
    normalizeEndpoint,
    normalizeObjectKey,
    sha256Hex
} from './utils'

function formatDateParts(date: Date) {
    const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
    return {
        amzDate: iso,
        dateStamp: iso.slice(0, 8)
    }
}

function createUrl(config: SysOssConfigDto, objectKey: string) {
    const bucket = getBucket(config)
    const endpoint = normalizeEndpoint(config.endpoint, config.isHttps ?? 1)
    const encodedKey = encodePathname(`/${objectKey}`).slice(1)

    if (endpoint) {
        return new URL(`${endpoint}/${bucket}/${encodedKey}`)
    }

    const region = config.region || 'us-east-1'
    return new URL(`https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`)
}

function createHeaders(method: 'PUT' | 'DELETE', url: URL, body: OssBody, config: SysOssConfigDto) {
    const region = config.region || 'us-east-1'
    const accessKey = getRequired(config.accessKey, 'AccessKey')
    const secretKey = getRequired(config.secretKey, 'SecretKey')
    const { amzDate, dateStamp } = formatDateParts(new Date())
    const payloadHash = sha256Hex(body)
    const canonicalHeaders = [
        `host:${url.host}`,
        `x-amz-content-sha256:${payloadHash}`,
        `x-amz-date:${amzDate}`,
        ''
    ].join('\n')
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
    const canonicalRequest = [
        method,
        encodePathname(url.pathname),
        '',
        canonicalHeaders,
        signedHeaders,
        payloadHash
    ].join('\n')
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        sha256Hex(canonicalRequest)
    ].join('\n')
    const signingKey = hmacSha256(hmacSha256(hmacSha256(hmacSha256(`AWS4${secretKey}`, dateStamp), region), 's3'), 'aws4_request')
    const signature = hmacSha256Hex(signingKey, stringToSign)

    return {
        Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate
    }
}

async function request(method: 'PUT' | 'DELETE', config: SysOssConfigDto, objectKey: string, body: OssBody = new Uint8Array() as OssBody, contentType?: string) {
    const url = createUrl(config, objectKey)
    const headers: Record<string, string> = {
        ...createHeaders(method, url, body, config)
    }
    if (method === 'PUT' && contentType) {
        headers['content-type'] = contentType
    }

    const response = await fetch(url, {
        method,
        headers,
        body: method === 'PUT' ? body as unknown as BodyInit : undefined
    })
    await assertOk(response, `AWS ${method}`)
    return { response, url }
}

export const awsProvider: OssProvider = {
    service: 'aws',
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
