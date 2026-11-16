import type { Context } from '#admin/server/trpc/context'
import type { GenTableConfig } from '#admin/shared/system/gen'
import { AppError } from '#admin/server/utils/appError'
import { sysGenService } from '#admin/server/sys-router/gen/SysGenService'

export type ResolveGenConfigInput = {
    tableId?: string
    tableName?: string
    moduleName?: string
    businessName?: string
}

/**
 * AI 接口的配置解析：
 * - tableId 优先；
 * - tableName 未导入时自动从 information_schema 导入；
 * - 可选覆盖 moduleName / businessName。
 */
export async function resolveGenConfig(ctx: Context, input: ResolveGenConfigInput): Promise<GenTableConfig> {
    const service = sysGenService(ctx)

    if (input.tableId) {
        return await service.getConfig(input.tableId)
    }

    const tableName = String(input.tableName ?? '').trim()
    if (!tableName) {
        throw new AppError('form.required')
    }

    let config = await service.getConfigByTableName(tableName)

    if (!config) {
        await service.importTables([tableName])
        config = await service.getConfigByTableName(tableName)
    }

    if (!config) {
        throw new AppError('module.system.gen.tableNotFound')
    }

    const moduleName = input.moduleName?.trim()
    const businessName = input.businessName?.trim()

    if ((moduleName && moduleName !== config.table.moduleName)
        || (businessName && businessName !== config.table.businessName)) {
        const id = String(config.table.id ?? '')
        if (!id) {
            throw new AppError('common.notExist')
        }

        await service.updateTable({
            id,
            tableComment: config.table.tableComment ?? undefined,
            moduleName: moduleName || String(config.table.moduleName ?? ''),
            businessName: businessName || String(config.table.businessName ?? ''),
            author: config.table.author ?? undefined,
            remark: config.table.remark ?? undefined,
        })
        config = await service.getConfig(id)
    }

    return config
}
