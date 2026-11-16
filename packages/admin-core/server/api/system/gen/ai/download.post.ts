import JSZip from 'jszip'
import { requireCodegenAiAccess } from '#admin/server/utils/codegenAiAccess'
import { apiOperationLog } from '#admin/server/utils/apiOperationLog'
import { createApiRouteError } from '#admin/server/utils/apiRouteError'
import { createServerT } from '#admin/server/utils/serverI18n'
import { resolveGenConfig, type ResolveGenConfigInput } from '#admin/server/gen/ai/resolveConfig'
import { buildCodegenAiPlan } from '#admin/server/gen/ai/plan'
import { resolveGenTable } from '#admin/server/gen/naming'
import { generateFiles } from '#admin/server/gen/templates'

export default defineEventHandler(async (event) => {
    const t = createServerT(event)

    try {
        const { ctx } = await requireCodegenAiAccess(event, 'system:gen:download')
        const operationLog = apiOperationLog(ctx, 'system.gen.ai.download')
        const body = await readBody<ResolveGenConfigInput>(event)

        const config = await resolveGenConfig(ctx, body ?? {})
        const plan = buildCodegenAiPlan(config)
        const allFiles = generateFiles(resolveGenTable(config.table, config.columns as any))

        const zip = new JSZip()
        for (const file of allFiles) {
            zip.file(file.path, file.content)
        }
        zip.file('ai-plan.json', JSON.stringify(plan, null, 2))

        const buffer = await zip.generateAsync({ type: 'nodebuffer' })
        const filename = `${plan.table.tableName}-codegen.zip`

        setHeader(event, 'Content-Type', 'application/zip')
        setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)

        await operationLog.success({
            requestParams: {
                tableName: body?.tableName,
                tableId: body?.tableId,
            },
            requestResult: {
                tableName: plan.table.tableName,
                fileCount: allFiles.length,
                filename,
            },
        })

        return buffer
    }
    catch (error) {
        throw createApiRouteError(error, t, 'module.system.gen.ai.downloadFailed')
    }
})
