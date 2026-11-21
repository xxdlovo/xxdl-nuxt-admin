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
        domain: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3001',
        title: 'xxdl-nuxt-admin 文档',
        description: '全栈 Nuxt 4 后台系统：分层架构、RBAC、会员能力与配额、支付与钱包、缓存与任务约定',
        // 显式声明集合，避免自动生成的 section 标题变成 "Content"/"ModuleA"。
        // ⚠️ 一旦显式声明，新增文档集合（content.config.ts 里的新集合）必须在此补一行，
        //   否则该集合的文档不会出现在 llms.txt / llms-full.txt 中。
        sections: [
            { title: '系统文档', description: '后端/前端/支付/交易/对外集成等完整文档', contentCollection: 'content' },
            { title: '业务模块文档', description: '按业务独立成集的文档（示例：moduleA）', contentCollection: 'moduleA' }
        ],
        full: { title: '完整文档', description: '上述集合的全文，供 LLM 检索' }
    },
    devServer: {
        host: '0.0.0.0',
        port: 3001
    }
})
