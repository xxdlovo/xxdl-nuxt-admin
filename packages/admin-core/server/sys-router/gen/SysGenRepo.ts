import { CommonRepo } from '#admin/server/drizzle/CommonRepo'
import type { Context } from '#admin/server/trpc/context'
import { GenTableBaseSchema } from '#admin/shared/system/gen'
import { sysGenTable, sysGenTableColumn } from '#admin/server/drizzle/schema'
import { and, asc, eq, inArray } from 'drizzle-orm'

const commonRepo = CommonRepo(sysGenTable, GenTableBaseSchema)

export function sysGenTableRepo(ctx: Context) {
    const repo = commonRepo(ctx)

    return {
        ...repo,

        async findByTableName(tableName: string) {
            const rows = await ctx.db
                .select()
                .from(sysGenTable)
                .where(and(
                    eq(sysGenTable.tableName, tableName),
                    eq(sysGenTable.isDeleted, 0)
                ))
                .limit(1)

            return rows[0] ?? null
        },

        async listImportedTableNames() {
            const rows = await ctx.db
                .select({ tableName: sysGenTable.tableName })
                .from(sysGenTable)
                .where(eq(sysGenTable.isDeleted, 0))

            return rows.map(row => row.tableName)
        },

        async listColumns(tableId: string) {
            return await ctx.db
                .select()
                .from(sysGenTableColumn)
                .where(and(
                    eq(sysGenTableColumn.tableId, tableId),
                    eq(sysGenTableColumn.isDeleted, 0)
                ))
                .orderBy(asc(sysGenTableColumn.sortOrder))
        },

        async findColumn(tableId: string, columnName: string) {
            const rows = await ctx.db
                .select()
                .from(sysGenTableColumn)
                .where(and(
                    eq(sysGenTableColumn.tableId, tableId),
                    eq(sysGenTableColumn.columnName, columnName)
                ))
                .limit(1)

            return rows[0] ?? null
        },

        async createColumn(data: typeof sysGenTableColumn.$inferInsert) {
            await ctx.db.insert(sysGenTableColumn).values(data)
        },

        async updateColumn(id: string, data: Partial<typeof sysGenTableColumn.$inferInsert>) {
            await ctx.db
                .update(sysGenTableColumn)
                .set(data)
                .where(eq(sysGenTableColumn.id, id))
        },

        async removeColumnsByTableId(tableId: string) {
            await ctx.db
                .update(sysGenTableColumn)
                .set({ isDeleted: 1 })
                .where(and(
                    eq(sysGenTableColumn.tableId, tableId),
                    eq(sysGenTableColumn.isDeleted, 0)
                ))
        },

        async removeColumn(id: string) {
            await ctx.db
                .update(sysGenTableColumn)
                .set({ isDeleted: 1 })
                .where(eq(sysGenTableColumn.id, id))
        },

        async removeByIds(ids: string[]) {
            if (ids.length === 0) {
                return
            }

            // 代码生成配置是纯元数据，删除时直接物理删除，避免唯一键 table_name 阻止再次导入
            await ctx.db
                .delete(sysGenTableColumn)
                .where(inArray(sysGenTableColumn.tableId, ids))
            await ctx.db
                .delete(sysGenTable)
                .where(inArray(sysGenTable.id, ids))
        },
    }
}
