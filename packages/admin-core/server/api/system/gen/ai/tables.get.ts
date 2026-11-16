import { requireCodegenAiAccess } from '#admin/server/utils/codegenAiAccess'
import { createApiRouteError } from '#admin/server/utils/apiRouteError'
import { createServerT } from '#admin/server/utils/serverI18n'
import { sysGenService } from '#admin/server/sys-router/gen/SysGenService'

export default defineEventHandler(async (event) => {
    const t = createServerT(event)

    try {
        const { ctx } = await requireCodegenAiAccess(event, 'system:gen:list')
        const tables = await sysGenService(ctx).listTables()

        return {
            success: true,
            data: tables.map(table => ({
                id: table.id,
                tableName: table.tableName,
                tableComment: table.tableComment,
                moduleName: table.moduleName,
                businessName: table.businessName,
                updatedAt: table.updatedAt,
            })),
        }
    }
    catch (error) {
        throw createApiRouteError(error, t, 'module.system.gen.ai.tablesFailed')
    }
})
