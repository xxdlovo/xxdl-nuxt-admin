import { createContext } from '#server/trpc/context'
import { sysOssService } from '#server/sys-router/oss/SysOssService'
import { apiOperationLog } from '#server/utils/apiOperationLog'
import { createApiRouteError } from '#server/utils/apiRouteError'
import { AppError } from '#server/utils/appError'
import { requirePermission } from '#server/utils/routeGuard'
import { createServerT } from '#server/utils/serverI18n'
import { crudPermissionCodes } from '#shared/auth'

function getMultipartField(parts: Awaited<ReturnType<typeof readMultipartFormData>>, name: string) {
    return parts?.find(part => part.name === name)
}

export default defineEventHandler(async (event) => {
    const t = createServerT(event)
    const start = Date.now()
    const ctx = await createContext(event)
    const operationLog = apiOperationLog(ctx, 'sysOss.upload', start)
    let requestParams: Record<string, unknown> = {}

    try {
        // 鉴权收在 routeGuard，与 tRPC 的 permissionMiddleware 规则保持一致
        await requirePermission(ctx, crudPermissionCodes('system:oss').add)

        const parts = await readMultipartFormData(event)
        const configId = getMultipartField(parts, 'configId')?.data?.toString('utf8') ?? ''
        const filePart = getMultipartField(parts, 'file')

        if (!filePart?.filename || !filePart.data?.byteLength) {
            throw new AppError('module.system.oss.uploadFileRequired')
        }

        requestParams = {
            configId,
            fileName: filePart.filename,
            fileSize: filePart.data.byteLength,
            contentType: filePart.type
        }

        const data = await sysOssService(ctx).uploadFile({
            configId,
            fileName: filePart.filename,
            contentType: filePart.type,
            body: new Uint8Array(filePart.data)
        })

        await operationLog.success({
            action: `upload ${filePart.filename}`,
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
            action: 'upload file',
            requestParams
        })

        throw createApiRouteError(error, t, 'module.system.oss.uploadFailed')
    }
})
