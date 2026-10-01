import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// session Cookie 是否要求 HTTPS。
//
// h3 的默认值为 secure: true。这个默认值在 HTTPS 域名下是正确的，
// 但浏览器会拒绝通过 http://IP:端口 访问时返回的 Secure Cookie，
// 导致登录接口虽然成功，后续读取 session 时仍然是未登录状态。
// 使用环境变量允许部署环境显式覆盖默认判断：
// - 本地开发（NODE_ENV 不是 production）默认关闭 Secure，兼容 HTTP；
// - 生产环境默认开启 Secure，要求通过 HTTPS 访问；
// - 如果生产环境暂时只能使用 HTTP，请设置 NUXT_SESSION_COOKIE_SECURE=false。
const sessionCookieSecure = process.env.NUXT_SESSION_COOKIE_SECURE !== undefined
    ? process.env.NUXT_SESSION_COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production'

// Swagger UI（/api/docs）渲染所需的两个文件。
//
// 为什么不直接用 nitro.serverAssets 读 node_modules：
// dev 模式下 serverAssets 不做全量挂载（实测 assets: 存储里只有被 rollup 引用过的条目），
// 文档页会因为读不到文件而 404；而 nitro.publicAssets 在 dev 由 Vite 接管静态资源，
// 同样不生效。复制到 public/ 后，dev 由 Vite 提供、构建时随 public 进入 .output/public，
// 两种环境行为一致，也不依赖生产镜像里的 node_modules（Dockerfile 只 COPY .output）。
//
// 注意：这些静态资源是匿名可访问的（开源 JS/CSS，不含业务数据）；
// 接口文档本身（/api/openapi.json 与 /api/docs 页面）依旧要求登录。
const swaggerUiFiles = ['swagger-ui-bundle.js', 'swagger-ui.css']
// 用配置文件自身的位置定位项目根目录，避免依赖启动时的工作目录
const projectRoot = fileURLToPath(new URL('.', import.meta.url))
const swaggerUiSourceDir = resolve(projectRoot, 'node_modules/swagger-ui-dist')
const swaggerUiPublicDir = resolve(projectRoot, 'public/swagger-ui')

function syncSwaggerUiAssets() {
    mkdirSync(swaggerUiPublicDir, { recursive: true })

    for (const file of swaggerUiFiles) {
        const source = resolve(swaggerUiSourceDir, file)

        if (existsSync(source)) {
            copyFileSync(source, resolve(swaggerUiPublicDir, file))
        }
    }
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
    ssr: false,
    routeRules: {
        // Set layout for specific route
        '/fi/**': { appLayout: 'system' }
    },
    // 忽略/app/layouts/modules/的文件导入但保留hmr. 更推荐的方法是放到components目录中
    hooks: {
        // dev 与 build 之前都把 Swagger UI 资源同步到 public/（见文件顶部说明）
        'build:before'() {
            syncSwaggerUiAssets()
        },
        'app:resolve'(app) {
            for (const [name, layout] of Object.entries(app.layouts)) {
                if (layout.file.replace(/\\/g, '/').includes('/app/layouts/modules/')) {
                    delete app.layouts[name]
                }
            }
        },
        // Nuxt 生成的 .nuxt/tsconfig.*.json 会写入 "libReplacement"，
        // 而当前 typescript@5.7.3 不识别该选项，pnpm typecheck 会以
        // TS5023 "Unknown compiler option 'libReplacement'" 失败。
        // 这里在类型准备阶段把它从生成的配置里摘掉。
        'prepare:types'(options: { tsConfig?: { compilerOptions?: Record<string, unknown> } }) {
            const compilerOptions = options?.tsConfig?.compilerOptions
            if (compilerOptions && 'libReplacement' in compilerOptions) {
                delete compilerOptions.libReplacement
            }
        }
    },
    modules: [
        '@nuxt/ui',
        'nuxt-echarts',
        'nuxt-i18n-micro',
        'nuxt-auth-utils',
        '@pinia/nuxt',
        'motion-v/nuxt',
        'pinia-plugin-persistedstate/nuxt',
        // 先从项目根目录注册 MDC。@nuxt/content 随后会复用该实例，
        // 避免 pnpm 隔离依赖布局下无法从内容模块内部定位 MDC。
        '@nuxtjs/mdc',
        // @nuxt/content 负责扫描 content.config.ts 并注册 Markdown 查询与渲染能力。
        // @nuxtjs/mdc 同样在 package.json 中显式声明，以适配 pnpm 的严格依赖解析。
        '@nuxt/content'
    ],
    // trpc-nuxt 2.1.x 的产物内部使用了 Nuxt 虚拟模块 #imports，
    // 该虚拟模块只能在 Nuxt 构建管线中解析。若不 transpile 该包，
    // Nitro 会把 node_modules 中的 ESM 直接交给 Node 解析，
    // 从而抛出 Package import specifier "#imports" is not defined。
    // 参考：https://github.com/wobsoriano/trpc-nuxt/issues/250
    build: {
        transpile: ['trpc-nuxt']
    },
    devServer: {
        host: '0.0.0.0',
        port: 3001
    },
    runtimeConfig: {
        demoMode: process.env.NUXT_DEMO_MODE === 'true',
        // OpenAPI 文档端点开关（/api/openapi.json、/api/docs）。
        // 默认开启；设置 NUXT_OPENAPI_ENABLED=false 可整体关闭并返回 404。
        openapiEnabled: process.env.NUXT_OPENAPI_ENABLED !== 'false',
        // nuxt-auth-utils 会把该配置传给 h3 的 useSession，
        // 登录接口 setUserSession 和客户端 /api/_auth/session 会共用这些 Cookie 规则。
        session: {
            // SessionConfig 的 password 在模块类型中是必填字段；这里保留空字符串作为配置默认值。
            // 真实密钥始终通过 NUXT_SESSION_PASSWORD 注入，Nuxt 会在运行时用该环境变量覆盖此值，
            // 因此不能在源码中填写真实密码，也不能省略该字段而触发 TypeScript 类型错误。
            password: '',
            cookie: {
                path: '/',
                sameSite: 'lax',
                httpOnly: true,
                secure: sessionCookieSecure
            }
        },
        db: {
            host: '',
            user: '',
            password: '',
            database: '',
        },
        // 客户端可访问的环境变量
        public: {
            appName: 'Nuxt Admin System'
        }
    },
    nitro: {
        // 业务临时数据使用独立的 memory 命名空间，避免误读 Nitro 默认
        // storage 中的 data、cache、root、build 等框架内部内容。
        storage: {
            memory: {
                driver: 'memory'
            }
        },
        experimental: {
            tasks: true
        },
        scheduledTasks: {
            // '* * * * *': ['sys-job:dispatch']
        }
    },
    ui: {
        // 关闭谷歌字体
        fonts: false
    },
    css: ['~/assets/css/main.css'],
    icon: {
        provider: 'server',
        clientBundle: {
            includeCustomCollections: true
        },
        customCollections: [{
            prefix: 'custom',
            dir: './app/assets/icons'
        }]
    },
    i18n: {
        // 路由跳转时没有/zh,/en的路径
        strategy: 'no_prefix',
        // 统一语言 Cookie 名称，避免模块默认的 user-locale 与业务代码使用的
        // i18n_locale 不一致，导致重启后模块读取不到上次选择的语言并回退英文。
        localeCookie: 'i18n_locale',
        locales: [
            { code: 'en', iso: 'en-US', dir: 'ltr', name: 'English' },
            { code: 'zh', iso: 'zh-CN', dir: 'ltr', name: '中文' }
        ],
        defaultLocale: 'en',
        translationDir: 'app/locales',
        meta: true,
    },
    echarts: {
        charts: ['BarChart', 'LineChart', 'PieChart'],
        components: ['DatasetComponent', 'GridComponent', 'TooltipComponent', 'LegendComponent'],
    }
})
