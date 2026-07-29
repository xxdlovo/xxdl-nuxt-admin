import { createContext } from '#server/trpc/context'
import { sysOssService } from '#server/sys-router/oss/SysOssService'
import { logRecorder } from '#server/sys-router/systemLog/LogRecorderService'
import { AppError } from '#server/utils/appError'
import { createServerT } from '#server/utils/serverI18n'

function getMultipartField(parts: Awaited<ReturnType<typeof readMultipartFormData>>, name: string) {
    return parts?.find(part => part.name === name)
}

export default defineEventHandler(async (event) => {
    const t = createServerT(event)
    const start = Date.now()
    const ctx = await createContext(event)
    let requestParams: Record<string, unknown> = {}

    try {
        if (!ctx.user) {
            throw new AppError('auth.unauthorized')
        }

        const parts = await readMultipartFormData(event)
        const filePart = getMultipartField(parts, 'file')

        if (!filePart?.filename || !filePart.data?.byteLength) {
            throw new AppError('module.system.oss.uploadFileRequired')
        }

        const contentType = filePart.type || 'application/octet-stream'
        if (!contentType.startsWith('image/')) {
            throw new AppError('module.system.oss.uploadFileRequired')
        }

        requestParams = {
            fileName: filePart.filename,
            fileSize: filePart.data.byteLength,
            contentType
        }

        const config = await sysOssService(ctx).getDefaultUploadConfig()
        if (!config?.id) {
            throw new AppError('module.system.oss.uploadConfigUnavailable')
        }

        const data = await sysOssService(ctx).uploadFile({
            configId: config.id,
            fileName: filePart.filename,
            contentType,
            body: new Uint8Array(filePart.data)
        })

        await logRecorder(ctx).systemSuccess(
            'sysUser.avatarUpload',
            `upload avatar ${filePart.filename} success ${Date.now() - start}ms`,
            {
                requestMethod: 'POST',
                requestPath: '/api/system/user/avatar',
                durationMs: Date.now() - start,
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
            }
        )

        return {
            success: true,
            data
        }
    } catch (error) {
        await logRecorder(ctx).systemFailure(
            'sysUser.avatarUpload',
            error,
            `upload avatar failed ${Date.now() - start}ms`,
            {
                requestMethod: 'POST',
                requestPath: '/api/system/user/avatar',
                durationMs: Date.now() - start,
                requestParams
            }
        )

        const statusCode = error instanceof AppError
            ? error.i18nKey === 'auth.unauthorized' ? 401 : 400
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
