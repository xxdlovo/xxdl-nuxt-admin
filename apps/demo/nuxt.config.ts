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
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

type DocEntry = {
    /** content 路由路径（形如 `/features/cache/api`，根文档为 `/`） */
    path: string
    title: string
    description: string
}

/** 从 markdown 的 frontmatter 里取 title / description，取不到时回退到文件名。 */
function readFrontmatter(file: string, fallbackTitle: string) {
    const raw = readFileSync(file, 'utf-8')
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)?.[1] ?? ''
    const pick = (key: string) => {
        const match = new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(frontmatter)
        return match?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? ''
    }

    return {
        title: pick('title') || fallbackTitle,
        description: pick('description')
    }
}

/**
 * 扫描 doc 目录，得到 content 的路径 + 标题 + 摘要。
 *
 * path 规则与 content 一致：目录/文件名去掉数字前缀（`5.features` → `features`），
 * `index.md` 归到所在目录本身。
 */
function collectDocs(dir: string, prefix = ''): DocEntry[] {
    const docs: DocEntry[] = []

    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)

        if (statSync(full).isDirectory()) {
            const segment = entry.replace(/^\d+\./, '')
            docs.push(...collectDocs(full, `${prefix}/${segment}`))
            continue
        }

        if (!entry.endsWith('.md')) {
            continue
        }

        const name = entry.replace(/^\d+\./, '').replace(/\.md$/, '')
        const path = name === 'index' ? prefix : `${prefix}/${name}`
        docs.push({ path, ...readFrontmatter(full, name === 'index' ? (prefix.split('/').pop() || 'index') : name) })
    }

    return docs
}

/** 文档 → `/llms.txt` 里的一条链接。 */
function toLlmsLinks(docs: DocEntry[]) {
    return docs.map(doc => ({
        title: doc.title,
        description: doc.description,
        href: `/raw${doc.path || '/index'}.md`
    }))
}

/**
 * 把 doc 目录下的 markdown 映射成 `@nuxt/content` 的 raw 路由。
 *
 * 这些路由是 `/llms.txt` 里每条目对应的 markdown 地址（`/raw/<path>.md`）。在构建期
 * 预渲染成静态文件后，线上就不需要运行时 content 数据库；否则容器内 sqlite 初始化
 * 失败会让所有 `/raw/**` 直接 500，进而让 llms.txt 的链接全部不可用。
 */
function collectRawRoutes(dir: string, prefix = ''): string[] {
    return collectDocs(dir, prefix).map(doc => `/raw${doc.path || '/index'}.md`)
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
        // 仅作为兜底值：真正的站点地址在运行时由 server/plugins/llms-origin.ts 用请求
        // origin 改写，避免「构建机没有公网域名 → llms.txt 里写死 localhost」的问题。
        domain: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3001',
        // 关闭预渲染：llms.txt 必须运行时生成，才能拿到真实访问域名。
        // 构建期生成的静态文件会把 domain 固化在构建机环境里。
        prerender: false,
        title: 'xxdl-nuxt-admin 文档',
        description: '全栈 Nuxt 4 后台系统：分层架构、RBAC、会员能力与配额、支付与钱包、缓存与任务约定',
        // 目录在**构建期**扫描成静态 links，不声明 contentCollection：
        // 声明 contentCollection 会让 @nuxt/content 在每次请求生成 llms.txt 时查一次
        // content 的 sqlite；线上容器里这个运行时数据库初始化失败就会直接 500。
        // 静态 links 让 llms.txt 的生成完全不依赖数据库，同时仍能按请求域名改写链接。
        sections: [
            {
                title: '系统文档',
                description: '后端/前端/支付/交易/对外集成等完整文档',
                links: toLlmsLinks(collectDocs('doc/main'))
            },
            {
                title: '业务模块文档',
                description: '按业务独立成集的文档（示例：moduleA）',
                links: toLlmsLinks(collectDocs('doc/moduleA'))
            }
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
