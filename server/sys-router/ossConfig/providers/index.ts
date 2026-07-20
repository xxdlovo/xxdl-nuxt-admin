import type { OssProvider } from './types'
import { aliyunProvider } from './aliyun'
import { awsProvider } from './aws'
import { tencentProvider } from './tencent'

const providers: Record<string, OssProvider> = {
    aliyun: aliyunProvider,
    aws: awsProvider,
    tencent: tencentProvider
}

export function getOssProvider(service?: string | null) {
    if (!service) {
        return null
    }
    return providers[service.toLowerCase()] ?? null
}

export type { OssProvider, OssUploadInput } from './types'
