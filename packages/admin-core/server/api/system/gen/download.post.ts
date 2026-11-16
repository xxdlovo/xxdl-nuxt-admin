import JSZip from 'jszip'
import { createContext } from '#admin/server/trpc/context'
import { requirePermission } from '#admin/server/utils/routeGuard'
import { AppError } from '#admin/server/utils/appError'
import { apiOperationLog } from '#admin/server/utils/apiOperationLog'
import { createApiRouteError } from '#admin/server/utils/apiRouteError'
import { createServerT } from '#admin/server/utils/serverI18n'
import { sysGenService } from '#admin/server/sys-router/gen/SysGenService'
import { resolveGenTable } from '#admin/server/gen/naming'
import { generateFiles } from '#admin/server/gen/templates'

export default defineEventHandler(async (event) => {
    const ctx = await createContext(event)
    const t = createServerT(event)
    const operationLog = apiOperationLog(ctx, 'system.gen.download')

    try {
        await requirePermission(ctx, 'system:gen:download')
        // 生成配置是系统级数据，下载时不做部门数据范围过滤
        ctx.skipDataScope = true

        const body = await readBody<{ id?: string }>(event)
        const id = String(body?.id ?? '')
        if (!id) {
            throw new AppError('form.id.required')
        }

        const config = await sysGenService(ctx).getConfig(id)
        const resolved = resolveGenTable(config.table, config.columns as any)
        const files = generateFiles(resolved)

        const zip = new JSZip()
        for (const file of files) {
            zip.file(file.path, file.content)
        }

        const buffer = await zip.generateAsync({ type: 'nodebuffer' })
        const filename = `${resolved.tableName}-codegen.zip`

        setHeader(event, 'Content-Type', 'application/zip')
        setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)

        await operationLog.success({
            requestParams: { id, tableName: resolved.tableName, fileCount: files.length },
            requestResult: { fileCount: files.length, filename },
        })

        return buffer
    }
    catch (error) {
        await operationLog.failure(error)
        throw createApiRouteError(error, t, 'module.system.gen.downloadFailed')
    }
})
