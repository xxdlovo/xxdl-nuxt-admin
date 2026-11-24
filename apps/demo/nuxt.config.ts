// ============================================================================
// 演示站（官网 + 文档 + 在线演示）
//
// 与 apps/playground 的区别：
//   - playground 是「最小接入示例」，只有 3 个配置文件，证明业务项目需要写多薄；
//   - 本目录是「可直接访问的站点」，额外带官网落地页、文档站和演示页。
//
// 后台的每一行代码都来自 layer（extends 引入），本应用不含任何后台实现。
//
// 基座层 packages/admin-core 提供：
//   - 认证 / RBAC / 系统管理 / tRPC + Drizzle 后端 / 主题 / i18n
//   - modules、runtimeConfig 默认值、css、icon、nitro、类型补丁
// 电商层 packages/admin-trade 在其上提供会员/商品/订单/支付/钱包。
// ============================================================================
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 把 doc 目录下的 markdown 映射成 `@nuxt/content` 的 raw 路由。
 *
 * 这些路由是 `/llms.txt` 里每条目对应的 markdown 地址（`/raw/<path>.md`）。在构建期
 * 预渲染成静态文件后，线上就不需要运行时 content 数据库；否则容器内 sqlite 初始化
 * 失败会让所有 `/raw/**` 直接 500，进而让 llms.txt 的链接全部不可用。
 *
 * path 规则与 content 一致：目录/文件名去掉数字前缀（`5.features` → `features`），
 * `index.md` 归到所在目录本身。
 */
function collectRawRoutes(dir: string, prefix = ''): string[] {
    const routes: string[] = []

    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)

        if (statSync(full).isDirectory()) {
            const segment = entry.replace(/^\d+\./, '')
            routes.push(...collectRawRoutes(full, `${prefix}/${segment}`))
            continue
        }

        if (!entry.endsWith('.md')) {
            continue
        }

        const name = entry.replace(/^\d+\./, '').replace(/\.md$/, '')
        const path = name === 'index' ? prefix : `${prefix}/${name}`
        routes.push(`/raw${path || '/index'}.md`)
    }

    return routes
}

export default defineNuxtConfig({
    // 演示站接入完整能力（基座 + 电商层）。
    // 只需要系统管理的项目写 extends: ['xxdl-admin-core'] 即可，无需安装电商层。
    extends: ['../../packages/admin-trade'],
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
    // 后台页面统一 SPA（基座已对 /system/** 关闭 SSR），演示站也沿用同一渲染模式
    ssr: false,
    modules: [
        // nuxt-llms 必须排在 '@nuxt/content' 之前：
        // @nuxt/content 在自身 setup 时用 hasNuxtModule('nuxt-llms') 判断是否安装
        // dist/features/llms（把集合并入 llms.txt / llms-full.txt），
        // 若本模块排在后面就检测不到，集成会静默失效（官方 README 亦为此顺序）。
        'nuxt-llms',
        // 演示站专用：文档页依赖 @nuxt/content + MDC。
        // 先从项目根目录注册 MDC。@nuxt/content 随后会复用该实例，
        // 避免 pnpm 隔离依赖布局下无法从内容模块内部定位 MDC。
        '@nuxtjs/mdc',
        // @nuxt/content 负责扫描 content.config.ts 并注册 Markdown 查询与渲染能力。
        // @nuxtjs/mdc 同样在 package.json 中显式声明，以适配 pnpm 的严格依赖解析。
        '@nuxt/content'
    ],
    llms: {
        // 构建期必须设置 NUXT_PUBLIC_SITE_URL（CI 里按站点域名传），否则会回落成
        // localhost，导致 llms.txt 里的链接无法访问。
        // 预渲染策略：llms.txt 在构建期生成静态文件，链接域名必须构建时就确定。
        domain: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3001',
        title: 'xxdl-nuxt-admin 文档',
        description: '全栈 Nuxt 4 后台系统：分层架构、RBAC、会员能力与配额、支付与钱包、缓存与任务约定',
        // 显式声明集合，避免自动生成的 section 标题变成 "Content"/"ModuleA"。
        // 同时注意：一旦显式声明 contentCollection，@nuxt/content 就不会再自动补全集合
        // （否则同一批文档会被追加两次，llms.txt 出现重复链接）。
        // ⚠️ 新增文档集合（content.config.ts 里的新集合）必须在此补一行。
        sections: [
            { title: '系统文档', description: '后端/前端/支付/交易/对外集成等完整文档', contentCollection: 'content' },
            { title: '业务模块文档', description: '按业务独立成集的文档（示例：moduleA）', contentCollection: 'moduleA' }
        ]
        // 刻意不配 `full`：`/llms-full.txt` 改由 server/routes/llms-full.txt.get.ts 自己生成。
        // 原因：content 的 llms 特性会把每篇文档 AST 重新序列化回 markdown，本仓库 91 篇里有 82 篇
        // 会在 remark-mdc 的 strong 处理里栈溢出，导致预渲染 500、CI 构建失败。
        // 自建路由直接拼原始 markdown，无渲染风险，且对 LLM 更友好。
    },
    nitro: {
        // 把文档目录作为 server asset 打进产物：/llms-full.txt 在运行时（含预渲染）都能读到
        // 原始 markdown，不依赖部署环境里是否存在源码目录。
        serverAssets: [
            { baseName: 'docs-main', dir: 'doc/main' }
        ],
        prerender: {
            // CI 构建期就生成静态文件，避免上线后这条路才有机会报错。
            // `/raw/**` 一并预渲染：线上容器若无法初始化 content 的 sqlite，
            // 这些 markdown 仍能直接从静态产物返回。
            routes: [
                '/llms-full.txt',
                ...new Set([...collectRawRoutes('doc/main'), ...collectRawRoutes('doc/moduleA')])
            ]
        }
    },
    devServer: {
        host: '0.0.0.0',
        port: 3001
    }
})
