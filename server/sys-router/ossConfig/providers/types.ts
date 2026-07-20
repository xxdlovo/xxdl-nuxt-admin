import type { SysOssConfigDto } from '#shared/system/ossConfig'

export type OssBody = Uint8Array<ArrayBufferLike>

export type OssUploadInput = {
    objectKey: string
    body: OssBody
    contentType?: string
}

export type OssUploadResult = {
    url: string
    etag?: string | null
}

export type OssProvider = {
    service: string
    verify: (config: SysOssConfigDto) => Promise<void>
    upload: (config: SysOssConfigDto, input: OssUploadInput) => Promise<OssUploadResult>
    delete: (config: SysOssConfigDto, objectKey: string) => Promise<void>
}
