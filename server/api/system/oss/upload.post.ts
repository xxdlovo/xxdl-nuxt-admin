import { createContext } from '#server/trpc/context'
import { authService } from '#server/sys-router/auth/AuthService'
import { sysOssService } from '#server/sys-router/oss/SysOssService'
import { apiOperationLog } from '#server/utils/apiOperationLog'
import { AppError } from '#server/utils/appError'
import { createServerT } from '#server/utils/serverI18n'
import { crudPermissionCodes } from '#shared/auth'

async function assertUploadPermission(ctx: Awaited<ReturnType<typeof createContext>>) {
    const user = ctx.user
    if (!user) {
        throw new AppError('auth.unauthorized')
    }

    if (user.isAdmin === 1) {
        return
    }

    const permissionCodes = await authService(ctx).listPermissionCodes(user)
    if (!permissionCodes.includes(crudPermissionCodes('system:oss').add)) {
        throw new AppError('auth.forbidden')
    }
}

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
        await assertUploadPermission(ctx)

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

        const statusCode = error instanceof AppError
            ? error.i18nKey === 'auth.unauthorized' ? 401 : error.i18nKey === 'auth.forbidden' ? 403 : 400
            : 500
        const message = error instanceof AppError
            ? t(error.i18nKey)
            : error instanceof Error
                ? error.message
                : t('module.system.oss.uploadFailed')

        throw createError({
            statusCode,
            statusMessage: message,
            message
        })
    }
})
