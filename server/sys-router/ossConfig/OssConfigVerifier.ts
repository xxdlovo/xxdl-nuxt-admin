import type { SysOssConfigDto } from '#shared/system/ossConfig'
import { getOssProvider } from './providers'

export type VerifyResult = {
    success: boolean
    message: string
}

export async function verifyOssConfig(config: SysOssConfigDto): Promise<VerifyResult> {
    const provider = getOssProvider(config.service)

    if (!config.service) {
        return { success: false, message: '存储服务类型不能为空' }
    }

    if (!provider) {
        return { success: false, message: `暂不支持 ${config.service} 的自动验证` }
    }

    try {
        await provider.verify(config)
        return { success: true, message: '验证通过' }
    } catch (error) {
        const message = error instanceof Error ? error.message : '验证失败'
        return { success: false, message }
    }
}
