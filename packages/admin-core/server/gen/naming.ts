import type { GenColumnDto, GenTableDto } from '#admin/shared/system/gen'

export type ResolvedGenTable = {
    table: GenTableDto
    columns: GenColumnDto[]
    tableName: string
    tableComment: string
    moduleName: string
    businessName: string
    author: string
    schemaVar: string
    businessCamel: string
    businessCamelNoSys: string
    resourceCode: string
    routerKey: string
    i18nKey: string
    pageDir: string
    schemaPath: string
    sharedDir: string
    routerDir: string
    componentPrefix: string
    menuParentId: string
}

export function toPascal(value: string) {
    return value
        .replace(/[-_\s]+(.)?/g, (_, char: string) => char ? char.toUpperCase() : '')
        .replace(/^(.)/, char => char.toUpperCase())
}

export function toCamel(value: string) {
    const pascal = toPascal(value)
    return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

export function toKebab(value: string) {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[_\s]+/g, '-')
        .toLowerCase()
}

export function resolveGenTable(table: GenTableDto, columns: GenColumnDto[]): ResolvedGenTable {
    const tableName = String(table.tableName ?? '').trim()
    const moduleName = String(table.moduleName ?? '').trim().replace(/^\/+|\/+$/g, '')
    const segments = moduleName.split('/').filter(Boolean)
    const lastSegment = segments.at(-1) ?? tableName
    const businessName = String(table.businessName ?? toPascal(tableName)).trim() || toPascal(tableName)
    const businessCamel = toCamel(businessName)
    const businessCamelNoSys = toCamel(businessName.replace(/^Sys/, ''))
    const schemaVar = toCamel(tableName)
    const isSysBusiness = /^Sys/.test(businessName)

    const schemaPath = segments.length <= 1
        ? `server/drizzle/schema/${segments[0] ?? toKebab(tableName)}/index.ts`
        : `server/drizzle/schema/${segments.slice(0, -1).join('/')}/${toCamel(lastSegment)}.ts`

    const pageDir = `app/pages/${segments.map(toKebab).join('/')}`

    return {
        table,
        columns: [...columns].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
        tableName,
        tableComment: String(table.tableComment ?? '') || tableName,
        moduleName,
        businessName,
        author: String(table.author ?? '') || 'codegen',
        schemaVar,
        businessCamel,
        businessCamelNoSys,
        resourceCode: moduleName.replace(/\//g, ':'),
        routerKey: schemaVar,
        i18nKey: `module.${segments.join('.')}`,
        pageDir,
        schemaPath,
        sharedDir: `shared/${segments.join('/')}`,
        routerDir: `server/sys-router/${toCamel(lastSegment)}`,
        componentPrefix: isSysBusiness ? `sys-${toKebab(lastSegment)}` : toKebab(lastSegment),
        menuParentId: segments[0] === 'system'
            ? '10000000-0000-0000-0000-000000000100'
            : '<PARENT_MENU_ID>',
    }
}

export function zodTypeOf(column: GenColumnDto) {
    switch (column.tsType) {
        case 'number':
            return 'z.number()'
        case 'boolean':
            return 'z.boolean()'
        case 'unknown':
            return 'z.unknown()'
        default:
            return 'z.string()'
    }
}
