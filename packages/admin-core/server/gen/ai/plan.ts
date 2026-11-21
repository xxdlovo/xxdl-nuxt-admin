import type { GenFile, GenTableConfig } from '#admin/shared/system/gen'
import { resolveGenTable } from '#admin/server/gen/naming'
import { generateFiles } from '#admin/server/gen/templates'

export type CodegenAiMergePlan = {
    schemaIndex: {
        path: string
        importLine: string
        exportEntry: string
    }
    routers: {
        path: string
        importLine: string
        registration: string
    }
    locales: {
        zhPath: string
        enPath: string
        jsonPath: string[]
        zhSubtree: Record<string, unknown>
        enSubtree: Record<string, unknown>
    }
    menuSql: string
}

export type CodegenAiPlan = {
    table: {
        id: string
        tableName: string
        tableComment: string
        moduleName: string
        businessName: string
    }
    files: GenFile[]
    mergePlan: CodegenAiMergePlan
    instructions: string
    download: {
        method: 'POST'
        path: string
    }
    docsPath: string
    generatedAt: string
}

function schemaImportPath(schemaPath: string) {
    let value = schemaPath
        .replace(/^server\/drizzle\/schema\//, '')
        .replace(/\.ts$/, '')

    if (value.endsWith('/index')) {
        value = value.slice(0, -'/index'.length)
    }

    return `./${value}`
}

function getAtPath(source: unknown, path: string[]) {
    let current: any = source

    for (const segment of path) {
        if (!current || typeof current !== 'object') {
            return undefined
        }
        current = current[segment]
    }

    return current
}

export function buildCodegenAiPlan(config: GenTableConfig): CodegenAiPlan {
    const resolved = resolveGenTable(config.table, config.columns as any)
    const allFiles = generateFiles(resolved)
    const files = allFiles.filter(file => ![
        'sql/menu.sql',
        'README.md',
    ].includes(file.path)
        && !file.path.endsWith('.snippet.json')
        && !file.path.endsWith('.patch.md'))
    const jsonPath = ['module', ...String(config.table.moduleName ?? '').split('/').filter(Boolean)]

    const zhSnippet = allFiles.find(file => file.path.endsWith('zh.snippet.json'))
    const enSnippet = allFiles.find(file => file.path.endsWith('en.snippet.json'))
    const menuSql = allFiles.find(file => file.path === 'sql/menu.sql')?.content ?? ''

    const zhTree = zhSnippet ? JSON.parse(zhSnippet.content) : {}
    const enTree = enSnippet ? JSON.parse(enSnippet.content) : {}

    const mergePlan: CodegenAiMergePlan = {
        schemaIndex: {
            path: 'packages/admin-core/server/drizzle/schema/index.ts',
            importLine: `import { ${resolved.schemaVar} } from "${schemaImportPath(resolved.schemaPath)}"`,
            exportEntry: `${resolved.schemaVar},`,
        },
        routers: {
            path: 'packages/admin-core/server/trpc/routers.ts',
            importLine: `import { ${resolved.routerKey}Router } from '#admin/${resolved.routerDir}'`,
            registration: `${resolved.routerKey}: ${resolved.routerKey}Router,`,
        },
        locales: {
            zhPath: 'packages/admin-core/app/locales/zh.json',
            enPath: 'packages/admin-core/app/locales/en.json',
            jsonPath,
            zhSubtree: (getAtPath(zhTree, jsonPath) ?? {}) as Record<string, unknown>,
            enSubtree: (getAtPath(enTree, jsonPath) ?? {}) as Record<string, unknown>,
        },
        menuSql,
    }

    return {
        table: {
            id: String(config.table.id ?? ''),
            tableName: resolved.tableName,
            tableComment: resolved.tableComment,
            moduleName: resolved.moduleName,
            businessName: resolved.businessName,
        },
        files,
        mergePlan,
        instructions: [
            '1. 先按 files[].path 写入/覆盖生成文件。',
            '2. 不要整文件覆盖 schema/index.ts 和 routers.ts：只追加 mergePlan 中的 importLine / exportEntry / registration。',
            '3. 在 locales 的 jsonPath 处深合并 zhSubtree/enSubtree，保留已有词条。',
            '4. 执行 mergePlan.menuSql（替换占位 UUID 后再执行）。',
            '5. 合并后运行 pnpm --filter xxdl-nuxt-admin-demo typecheck 和 pnpm check:layers。',
            '6. 不要修改生成文件中的导出名、tRPC 路由名与权限码；如需调整请回到 V2 配置重新生成。',
            '完整说明见 GET /api/system/gen/ai/guide 或 /docs/main/new-module/codegen-v2。',
        ].join('\n'),
        download: {
            method: 'POST',
            path: '/api/system/gen/ai/download',
        },
        docsPath: '/docs/main/new-module/codegen-v2',
        generatedAt: new Date().toISOString(),
    }
}
