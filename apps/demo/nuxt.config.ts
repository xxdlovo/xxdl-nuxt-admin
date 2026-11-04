// ============================================================================
// 演示应用（宿主）配置
//
// 这个应用演示「业务项目如何接入基座」：只有 extends + 少量应用级配置，
// 不包含任何后台业务代码。
//
// 基座层 packages/admin-core 提供：
//   - 认证 / RBAC / 系统管理 / tRPC + Drizzle 后端 / 主题 / i18n
//   - modules、runtimeConfig 默认值、css、icon、nitro
// 本应用只提供：
//   - 官网落地页、文档站（@nuxt/content）、组件与动效演示页
//   - 开发端口、构建期 TS 兼容补丁
// ============================================================================
export default defineNuxtConfig({
    extends: ['../../packages/admin-core'],
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
    // 后台页面统一 SPA（基座已对 /system/** 关闭 SSR），演示站也沿用同一渲染模式
    ssr: false,
    hooks: {
        // Nuxt 生成的 .nuxt/tsconfig.*.json 会写入 "libReplacement"，
        // 而当前 typescript@5.7.3 不识别该选项，pnpm typecheck 会以
        // TS5023 "Unknown compiler option 'libReplacement'" 失败。
        // 这里在类型准备阶段把它从生成的配置里摘掉。
        //
        // 注意：这是宿主侧 TS 版本兼容补丁，不属于基座能力，因此留在宿主配置。
        'prepare:types'(options: { tsConfig?: { compilerOptions?: Record<string, unknown> } }) {
            const compilerOptions = options?.tsConfig?.compilerOptions
            if (compilerOptions && 'libReplacement' in compilerOptions) {
                delete compilerOptions.libReplacement
            }
        }
    },
    modules: [
        // 演示站专用：文档页依赖 @nuxt/content + MDC。
        // 先从项目根目录注册 MDC。@nuxt/content 随后会复用该实例，
        // 避免 pnpm 隔离依赖布局下无法从内容模块内部定位 MDC。
        '@nuxtjs/mdc',
        // @nuxt/content 负责扫描 content.config.ts 并注册 Markdown 查询与渲染能力。
        // @nuxtjs/mdc 同样在 package.json 中显式声明，以适配 pnpm 的严格依赖解析。
        '@nuxt/content'
    ],
    devServer: {
        host: '0.0.0.0',
        port: 3001
    }
})
