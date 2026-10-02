import { createContext } from '#server/trpc/context'
import { sysOssService } from '#server/sys-router/oss/SysOssService'
import { apiOperationLog } from '#server/utils/apiOperationLog'
import { createApiRouteError } from '#server/utils/apiRouteError'
import { AppError } from '#server/utils/appError'
import { requireLogin } from '#server/utils/routeGuard'
import { createServerT } from '#server/utils/serverI18n'

function getMultipartField(parts: Awaited<ReturnType<typeof readMultipartFormData>>, name: string) {
    return parts?.find(part => part.name === name)
}

export default defineEventHandler(async (event) => {
    const t = createServerT(event)
    const start = Date.now()
    const ctx = await createContext(event)
    const operationLog = apiOperationLog(ctx, 'sysUser.avatarUpload', start)
    let requestParams: Record<string, unknown> = {}

    try {
        // 头像只改自己的资料，登录即可；图片类型校验与存储配置解析都在 Service 内
        requireLogin(ctx)

        const parts = await readMultipartFormData(event)
        const filePart = getMultipartField(parts, 'file')

        if (!filePart?.filename || !filePart.data?.byteLength) {
            throw new AppError('module.system.oss.uploadFileRequired')
        }

        requestParams = {
            fileName: filePart.filename,
            fileSize: filePart.data.byteLength,
            contentType: filePart.type
        }

        const data = await sysOssService(ctx).uploadAvatar({
            fileName: filePart.filename,
            contentType: filePart.type,
            body: new Uint8Array(filePart.data)
        })

        await operationLog.success({
            action: `upload avatar ${filePart.filename}`,
            requestParams,
            requestResult: {
                id: data.id,
                originalName: data.originalName,
                fileName: data.fileName,
                fileSize: data.fileSize,
                service: data.service,
                bucketName: data.bucketName,
                objectName: data.objectName,
                url: data.url
            }
        })

        return {
            success: true,
            data
        }
    } catch (error) {
        await operationLog.failure(error, {
            action: 'upload avatar',
            requestParams
        })

        throw createApiRouteError(error, t, 'module.system.oss.uploadFailed')
    }
})
