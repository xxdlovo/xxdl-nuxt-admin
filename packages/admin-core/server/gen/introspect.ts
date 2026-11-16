import { sql } from 'drizzle-orm'
import type { Context } from '#admin/server/trpc/context'
import type { GenColumnDto, GenDbTable } from '#admin/shared/system/gen'
import { toCamel, toKebab, toPascal } from './naming'

type DbTableRow = {
    tableName?: string
    tableComment?: string | null
}

type DbColumnRow = {
    columnName?: string
    columnComment?: string | null
    columnType?: string | null
    isNullable?: string | null
    columnKey?: string | null
    ordinalPosition?: number | null
}

function rowsOf(result: unknown): any[] {
    if (Array.isArray(result) && Array.isArray(result[0])) {
        return result[0] as any[]
    }
    if (result && typeof result === 'object' && Array.isArray((result as any).rows)) {
        return (result as any).rows
    }
    return Array.isArray(result) ? result as any[] : []
}

export async function readDbTables(ctx: Context): Promise<GenDbTable[]> {
    const result = await ctx.db.execute(sql`
        SELECT TABLE_NAME AS tableName, TABLE_COMMENT AS tableComment
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_TYPE = 'BASE TABLE'
          AND TABLE_NAME NOT LIKE 'sys_gen_%'
        ORDER BY TABLE_NAME
    `)

    return rowsOf(result).map((row: DbTableRow) => ({
        tableName: String(row.tableName ?? ''),
        tableComment: String(row.tableComment ?? ''),
        imported: false,
    }))
}

export async function readDbColumns(ctx: Context, tableName: string): Promise<DbColumnRow[]> {
    const result = await ctx.db.execute(sql`
        SELECT COLUMN_NAME AS columnName,
               COLUMN_COMMENT AS columnComment,
               COLUMN_TYPE AS columnType,
               IS_NULLABLE AS isNullable,
               COLUMN_KEY AS columnKey,
               ORDINAL_POSITION AS ordinalPosition
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ${tableName}
        ORDER BY ORDINAL_POSITION
    `)

    return rowsOf(result) as DbColumnRow[]
}

export function deriveModuleName(tableName: string) {
    const clean = tableName.replace(/^sys_/, '')
    return tableName.startsWith('sys_')
        ? `system/${toKebab(clean)}`
        : toKebab(tableName)
}

export function deriveBusinessName(tableName: string) {
    return toPascal(tableName)
}

function tsTypeOf(columnType: string) {
    const base = columnType.toLowerCase().replace(/\(.*/, '')
    if (['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint', 'decimal', 'numeric', 'float', 'double'].includes(base)) {
        return 'number'
    }
    if (['bit', 'boolean'].includes(base)) {
        return 'boolean'
    }
    if (['json'].includes(base)) {
        return 'unknown'
    }
    return 'string'
}

function htmlTypeOf(name: string, columnType: string) {
    if (name === 'status') return 'select'
    if (name === 'password') return 'password'
    if (['text', 'mediumtext', 'longtext', 'tinytext'].includes(columnType.toLowerCase().replace(/\(.*/, ''))) return 'textarea'
    if (name === 'remark' || name === 'content') return 'textarea'
    if (name.endsWith('_at') || ['date', 'datetime', 'timestamp'].includes(columnType.toLowerCase().replace(/\(.*/, ''))) return 'date'
    if (tsTypeOf(columnType) === 'number') return 'number'
    return 'input'
}

export function deriveColumnConfig(tableId: string, row: DbColumnRow, index: number): GenColumnDto {
    const columnName = String(row.columnName ?? '')
    const columnType = String(row.columnType ?? 'varchar(255)')
    const isPk = row.columnKey === 'PRI'
    const isNullable = row.isNullable === 'YES'
    const isAudit = ['created_by', 'created_at', 'updated_by', 'updated_at', 'is_deleted'].includes(columnName)
    const isQuery = !isAudit
        && !isPk
        && (columnName === 'status' || /name|code|title|keyword/.test(columnName))
    const isLike = /name|code|title|keyword/.test(columnName)

    return {
        tableId,
        columnName,
        columnComment: String(row.columnComment ?? ''),
        columnType,
        tsType: tsTypeOf(columnType),
        propertyName: toCamel(columnName),
        isPk: isPk ? 1 : 0,
        isRequired: !isNullable && !isAudit ? 1 : 0,
        isInsert: !isPk && !isAudit ? 1 : 0,
        isEdit: !isPk && !isAudit ? 1 : 0,
        isList: !isAudit && !isPk ? 1 : 0,
        isQuery: isQuery ? 1 : 0,
        queryType: isLike ? 'like' : 'eq',
        dictCode: columnName === 'status' ? 'enable_status' : null,
        htmlType: htmlTypeOf(columnName, columnType),
        sortOrder: Number(row.ordinalPosition ?? index + 1),
    }
}
