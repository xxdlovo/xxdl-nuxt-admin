import { getRequestURL } from 'h3'
import { createContext } from '#admin/server/trpc/context'
import { requirePermission } from '#admin/server/utils/routeGuard'
import { AppError } from '#admin/server/utils/appError'
import { createApiRouteError } from '#admin/server/utils/apiRouteError'
import { createServerT } from '#admin/server/utils/serverI18n'
import { resolveGenConfig } from '#admin/server/gen/ai/resolveConfig'
import { issueCodegenAiToken } from '#admin/server/utils/codegenAiToken'

/**
 * 列表行「AI」按钮的提示词。
 *
 * 返回的 prompt 已替换表名/模块名/业务名，并带上访问令牌；
 * 前端直接复制到剪贴板，外部 AI 即可执行 CLI。
 */
export default defineEventHandler(async (event) => {
    const t = createServerT(event)

    try {
        const ctx = await createContext(event)
        await requirePermission(ctx, 'system:gen:list')
        ctx.skipDataScope = true

        const query = getQuery(event)
        const tableId = typeof query.tableId === 'string' ? query.tableId : undefined
        const tableName = typeof query.tableName === 'string' ? query.tableName : undefined
        const config = await resolveGenConfig(ctx, { tableId, tableName })

        const runtimeConfig = useRuntimeConfig(event) as {
            codegenToken?: string
            codegenCopySecret?: boolean
        }

        let token = ''
        let tokenMode: 'static' | 'ephemeral' = 'ephemeral'
        let expiresAt: string | null = null

        if (runtimeConfig.codegenCopySecret && runtimeConfig.codegenToken) {
            token = runtimeConfig.codegenToken
            tokenMode = 'static'
        }
        else {
            const issued = issueCodegenAiToken(event)
            if (!issued) {
                throw new AppError('module.system.gen.ai.tokenUnavailable')
            }
            token = issued.token
            expiresAt = issued.expiresAt
        }

        const url = getRequestURL(event)
        const baseUrl = `${url.protocol}//${url.host}`
        const table = config.table
        const prompt = `你是一个代码生成执行代理。请按下面的步骤完成模块生成与合并。

## 运行环境（PowerShell）
$env:CODEGEN_BASE_URL='${baseUrl}'
$env:CODEGEN_TOKEN='${token}'

## 本次模块
tableName: ${table.tableName}
moduleName: ${table.moduleName}
businessName: ${table.businessName}

## 步骤
1. 先读取指南：GET ${baseUrl}/api/system/gen/ai/guide（或阅读 /docs/main/new-module/codegen-v2）。
2. 在项目根目录执行：
   pnpm gen:ai:plan --table=${table.tableName} --module=${table.moduleName} --business=${table.businessName}
   如果 CLI 不可用，也可以直接 POST ${baseUrl}/api/system/gen/ai/plan，body 为：
   {"tableName":"${table.tableName}","moduleName":"${table.moduleName}","businessName":"${table.businessName}"}
3. 按返回的 files 写入/覆盖对应文件。
4. 按 mergePlan 合并以下文件，不要整文件覆盖：
   - server/drizzle/schema/index.ts：追加 importLine 与 exportEntry
   - server/trpc/routers.ts：追加 importLine 与 registration
   - app/locales/zh.json、en.json：在 jsonPath 处深合并 zhSubtree/enSubtree，保留已有词条
5. 执行 mergePlan.menuSql（先替换菜单 UUID 占位符）。
6. 运行 pnpm --filter xxdl-nuxt-admin-demo typecheck 和 pnpm check:layers。
7. 如果失败，读取错误并修正生成文件后重试；不要改动无关文件。

## 约束
- 不要修改生成文件中的导出名、tRPC 路由名、权限码。
- 不要覆盖 schema/index.ts、routers.ts 的其它内容。
- 令牌仅用于代码生成只读接口，${expiresAt ? `将在 ${expiresAt} 过期` : '为长期令牌'}。`

        return {
            success: true,
            data: {
                prompt,
                tokenMode,
                expiresAt,
                table: {
                    id: table.id,
                    tableName: table.tableName,
                    moduleName: table.moduleName,
                    businessName: table.businessName,
                },
            },
        }
    }
    catch (error) {
        throw createApiRouteError(error, t, 'module.system.gen.ai.promptFailed')
    }
})
