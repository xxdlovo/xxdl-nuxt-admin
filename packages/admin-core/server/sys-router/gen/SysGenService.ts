import { useLogger } from 'evlog'
import { randomUuid } from '#admin/shared/utils/uuid'
import type { Context } from '#admin/server/trpc/context'
import type { OrmPageResp } from '#admin/server/utils/ApiResp'
import { AppError } from '#admin/server/utils/appError'
import type {
    GenColumnDto,
    GenColumnSaveDTO,
    GenDbTable,
    GenFile,
    GenPageQueryDTO,
    GenSaveColumnsDTO,
    GenTableConfig,
    GenTableDto,
    GenUpdateTableDTO,
} from '#admin/shared/system/gen'
import { sysGenTableRepo } from './SysGenRepo'
import {
    deriveBusinessName,
    deriveColumnConfig,
    deriveModuleName,
    readDbColumns,
    readDbTables,
} from '#admin/server/gen/introspect'
import { resolveGenTable } from '#admin/server/gen/naming'
import { generateFiles } from '#admin/server/gen/templates'

export function sysGenService(ctx: Context) {
    const repo = sysGenTableRepo(ctx)
    const log = useLogger(ctx.event, 'server/sys-router/gen')

    async function loadConfig(id: string): Promise<GenTableConfig> {
        const table = await repo.getById(id) as GenTableDto | null
        if (!table) {
            throw new AppError('common.notExist')
        }

        const columns = await repo.listColumns(id) as GenColumnDto[]
        return { table, columns }
    }

    return {
        async page(req: GenPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            const result = await repo.page(page, pageSize, dto, [])
            log.info('gen table page queried', { gen: { action: 'page', page, pageSize, total: result.total } })
            return result
        },

        async dbTables(): Promise<GenDbTable[]> {
            const [tables, importedNames] = await Promise.all([
                readDbTables(ctx),
                repo.listImportedTableNames(),
            ])
            const imported = new Set(importedNames)
            const result = tables.map(table => ({
                ...table,
                imported: imported.has(table.tableName),
            }))
            log.info('gen db tables listed', { gen: { action: 'dbTables', count: result.length } })
            return result
        },

        async importTables(tableNames: string[]): Promise<{ imported: number, tables: number }> {
            const allTables = await readDbTables(ctx)
            const tableMap = new Map(allTables.map(table => [table.tableName, table]))
            let tableCount = 0
            let importedCount = 0

            for (const tableName of Array.from(new Set(tableNames))) {
                const dbTable = tableMap.get(tableName)
                if (!dbTable) {
                    continue
                }

                let table = await repo.findByTableName(tableName)
                if (!table) {
                    const id = randomUuid()
                    await repo.create({
                        id,
                        tableName,
                        tableComment: dbTable.tableComment || tableName,
                        moduleName: deriveModuleName(tableName),
                        businessName: deriveBusinessName(tableName),
                        author: ctx.user?.nickname || ctx.user?.username || null,
                        remark: null,
                    } as any)
                    table = await repo.getById(id)
                    tableCount += 1
                }
                else {
                    await repo.updateById(table.id, {
                        tableComment: dbTable.tableComment || table.tableComment,
                    } as any)
                }

                if (!table?.id) {
                    continue
                }

                const columns = await readDbColumns(ctx, tableName)
                for (let index = 0; index < columns.length; index += 1) {
                    const row = columns[index]!
                    const columnName = String(row.columnName ?? '')
                    const existing = await repo.findColumn(table.id, columnName)

                    if (!existing) {
                        const derived = deriveColumnConfig(table.id, row, index)
                        await repo.createColumn({
                            ...derived,
                            id: randomUuid(),
                        } as any)
                        importedCount += 1
                    }
                    else {
                        // 只同步数据库侧的类型/注释，保留用户手动改过的属性名、查询/表单开关
                        await repo.updateColumn(existing.id, {
                            columnType: String(row.columnType ?? existing.columnType),
                            columnComment: String(row.columnComment ?? existing.columnComment ?? ''),
                        } as any)
                    }
                }
            }

            log.info('gen tables imported', { gen: { action: 'importTables', tables: tableCount, columns: importedCount } })
            return { imported: importedCount, tables: tableCount }
        },

        async getConfig(id: string): Promise<GenTableConfig> {
            return await loadConfig(id)
        },

        /** 按表名取配置：AI 接口在未导入时可先 importTables，再调用这里。 */
        async getConfigByTableName(tableName: string): Promise<GenTableConfig | null> {
            const table = await repo.findByTableName(tableName)
            if (!table) {
                return null
            }

            const columns = await repo.listColumns(table.id) as GenColumnDto[]
            return { table: table as GenTableDto, columns }
        },

        /** AI 接口：列出已导入的生成配置（不分页，量级很小）。 */
        async listTables(): Promise<GenTableDto[]> {
            const list = await repo.list({}, []) as GenTableDto[]
            log.info('gen tables listed for ai', { gen: { action: 'listTables', count: list.length } })
            return list
        },

        async updateTable(data: GenUpdateTableDTO): Promise<boolean> {
            const current = await repo.getById(data.id)
            if (!current) {
                throw new AppError('common.notExist')
            }

            await repo.updateById(data.id, {
                tableComment: data.tableComment,
                moduleName: data.moduleName,
                businessName: data.businessName,
                author: data.author,
                remark: data.remark,
            } as any)
            log.info('gen table updated', { gen: { action: 'updateTable', id: data.id } })
            return true
        },

        async saveColumns(data: GenSaveColumnsDTO): Promise<boolean> {
            const table = await repo.getById(data.tableId)
            if (!table) {
                throw new AppError('common.notExist')
            }

            const existing = await repo.listColumns(data.tableId)
            const existingIds = new Set(existing.map(column => column.id))

            for (const column of data.columns) {
                if (!existingIds.has(column.id)) {
                    continue
                }

                await repo.updateColumn(column.id, {
                    columnComment: column.columnComment,
                    tsType: column.tsType,
                    propertyName: column.propertyName,
                    isPk: column.isPk,
                    isRequired: column.isRequired,
                    isInsert: column.isInsert,
                    isEdit: column.isEdit,
                    isList: column.isList,
                    isQuery: column.isQuery,
                    queryType: column.queryType,
                    dictCode: column.dictCode,
                    htmlType: column.htmlType,
                    sortOrder: column.sortOrder,
                } as any)
            }

            log.info('gen columns saved', { gen: { action: 'saveColumns', id: data.tableId, count: data.columns.length } })
            return true
        },

        async remove(id: string): Promise<boolean> {
            await repo.removeByIds([id])
            log.info('gen table removed', { gen: { action: 'remove', id } })
            return true
        },

        async batchRemove(ids: string[]): Promise<number> {
            await repo.removeByIds(ids)
            log.info('gen tables batch removed', { gen: { action: 'batchRemove', count: ids.length } })
            return ids.length
        },

        async preview(id: string): Promise<GenFile[]> {
            const config = await loadConfig(id)
            const resolved = resolveGenTable(config.table, config.columns as GenColumnSaveDTO[] as any)
            log.info('gen preview generated', { gen: { action: 'preview', id } })
            return generateFiles(resolved)
        },
    }
}
