#!/usr/bin/env node
/**
 * 从运行中的实例导出 OpenAPI 文档到本地文件。
 *
 * 用法：
 *   pnpm dev                      # 另开一个终端启动服务
 *   pnpm openapi:export
 *
 * 环境变量：
 *   OPENAPI_URL     文档地址，默认 http://localhost:3001/api/openapi.json
 *   OPENAPI_OUTPUT  输出文件，默认 openapi/openapi.json
 *   OPENAPI_COOKIE  会话 Cookie（生产环境或权限收紧时需要），
 *                   例如 "nuxt-session=s%3A..."
 *
 * 之所以从 HTTP 拉取而不是直接 import appRouter：
 * 服务端代码依赖 Nuxt/Nitro 的路径别名与自动导入，独立进程无法可靠加载。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const url = process.env.OPENAPI_URL ?? 'http://localhost:3001/api/openapi.json'
const outputPath = resolve(process.cwd(), process.env.OPENAPI_OUTPUT ?? 'openapi/openapi.json')
const cookie = process.env.OPENAPI_COOKIE

async function main() {
    let response

    try {
        response = await fetch(url, {
            headers: cookie ? { cookie } : {}
        })
    }
    catch (error) {
        console.error(`[openapi:export] 无法连接 ${url}：${error instanceof Error ? error.message : error}`)
        console.error('[openapi:export] 请先启动服务（pnpm dev），或用 OPENAPI_URL 指定地址。')
        process.exitCode = 1
        return
    }

    if (response.status === 401 || response.status === 403) {
        console.error(`[openapi:export] ${url} 返回 ${response.status}：文档端点需要登录。`)
        console.error('[openapi:export] 请通过 OPENAPI_COOKIE 提供已登录会话的 Cookie。')
        process.exitCode = 1
        return
    }

    if (!response.ok) {
        console.error(`[openapi:export] ${url} 返回 ${response.status}`)
        process.exitCode = 1
        return
    }

    const document = await response.json()

    if (!document?.openapi) {
        console.error('[openapi:export] 响应不是合法的 OpenAPI 文档（缺少 openapi 字段）。')
        process.exitCode = 1
        return
    }

    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8')

    const pathCount = Object.keys(document.paths ?? {}).length
    const coverage = document['x-openapi-response-coverage']
    const warnings = document['x-openapi-warnings'] ?? []

    console.log(`[openapi:export] 已写入 ${outputPath}`)
    console.log(`[openapi:export] OpenAPI ${document.openapi}，接口 ${pathCount} 个`)

    if (coverage) {
        console.log(`[openapi:export] 响应 schema 覆盖 ${coverage.inferred}/${coverage.total}`)
        if (coverage.missing?.length) {
            console.log(`[openapi:export] 未覆盖：${coverage.missing.join('; ')}`)
        }
    }

    if (warnings.length) {
        console.warn(`[openapi:export] ${warnings.length} 条生成警告：`)
        for (const warning of warnings) {
            console.warn(`  - ${warning}`)
        }
    }
}

await main()
