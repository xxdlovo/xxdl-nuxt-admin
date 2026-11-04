import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
// Swagger UI 静态资源的同步逻辑抽在 scripts/ 下，发布前的 prepack 会复用同一份实现。
import { syncSwaggerUiAssets } from './scripts/sync-swagger.mjs'

// ============================================================================
// 基座层（Nuxt Layer）配置
//
// 本文件是 npm 包 xxdl-admin-core 的入口（package.json 的 main 字段）。
// 业务项目通过 `extends: ['xxdl-admin-core']` 继承本层，获得：
//   - app/pages、app/layouts、app/components、app/composables（自动扫描合并）
//   - server/**（tRPC 路由、drizzle、api、tasks）
//   - shared/**（zod schema 与公共类型）
//   - 下文的 modules / runtimeConfig / i18n / icon 等默认配置
//
// 重要约束（Nuxt Layer 的官方行为，已核对 Nuxt 4 源码）：
//   - 层内 `~/`、`@/`、`#server`、`#shared` 都解析到**宿主项目**，不是本包，
//     因此包内代码统一使用 `#admin/*`（见下方 alias）。
//   - `nuxt.config` 里的相对路径按宿主解析，所有路径必须用
//     `fileURLToPath(import.meta.url)` 绝对化。
// ============================================================================

const currentDir = fileURLToPath(new URL('.', import.meta.url))

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
// 同样不生效。复制到本层 public/ 后，dev 由 Vite 提供、构建时随 public 进入
// .output/public，两种环境行为一致，也不依赖生产镜像里的 node_modules
// （Dockerfile 只 COPY .output）。
//
// 具体实现在 ./scripts/sync-swagger.mjs，发布前的 prepack 钩子会复用同一份逻辑
// （public/swagger-ui 在 .gitignore 中，CI 全新 clone 时并不存在）。
//
// 注意：这些静态资源是匿名可访问的（开源 JS/CSS，不含业务数据）；
// 接口文档本身（/api/openapi.json 与 /api/docs 页面）依旧要求登录。

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    // $meta.name 会生成 `#layers/admin-core` 别名，便于宿主或其它层引用本层文件
    $meta: {
        name: 'admin-core'
    },
    compatibilityDate: '2025-07-15',
    alias: {
        '#admin': currentDir
    },
    // Nuxt 只会把 `shared/`、`modules/*/shared/`、`layers/*/shared/` 下的
    // 全局声明文件加入类型检查范围；本包位于 packages/ 下，需要显式补一条。
    //
    // 缺少这条时 `shared/types/auth.d.ts` 里的 `declare module '#auth-utils'`
    // 不会生效，服务端拿到的 User 只有 nuxt-auth-utils 的默认字段
    // （表现为 `Property 'id' does not exist on type 'User'`）。
    typescript: {
        tsConfig: {
            include: [
                `${resolve(currentDir, 'shared').replace(/\\/g, '/')}/**/*.d.ts`
            ]
        }
    },
    // 后台页面统一使用 SPA 渲染：
    // 本层大量代码直接访问 window/localStorage（主题、tabs、侧边栏状态），
    // 且登录态由 nuxt-auth-utils 的 session cookie 承担，无需服务端渲染。
    // 宿主的 SSR 不受影响，只有 /system/** 关闭。
    routeRules: {
        '/system/**': { ssr: false }
    },
    hooks: {
        // dev 与 build 之前都把 Swagger UI 资源同步到本层 public/（见文件顶部说明）
        'build:before'() {
            syncSwaggerUiAssets()
        },
        // app/layouts/modules/ 下的文件是布局内部的子组件，不是独立布局。
        // Nuxt 会把它们全部扫成 layout，这里主动剔除；组件本身由 components 目录提供。
        'app:resolve'(app) {
            for (const [name, layout] of Object.entries(app.layouts)) {
                if (layout.file.replace(/\\/g, '/').includes('/app/layouts/modules/')) {
                    delete app.layouts[name]
                }
            }
        },
        // Nuxt 4.5 生成的 .nuxt/tsconfig.*.json 会写入 "libReplacement"，
        // 而项目锁定的 typescript@5.7.3 不识别该选项，`pnpm typecheck` 会以
        // TS5023 "Unknown compiler option 'libReplacement'" 失败。
        //
        // 这属于「框架版本 × TS 版本」的兼容问题，**每个宿主都会遇到**，
        // 所以放在基座层统一处理，宿主无需重复配置。
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
        // evlog：请求级宽事件日志。每个 /api/trpc 请求在响应结束时输出一条
        // 带业务上下文的结构化事件（dev 彩色树形，生产 JSON）。
        'evlog/nuxt'
    ],
    // @pinia/nuxt 默认把 `storesDirs` 解析成「宿主 srcDir/stores」的绝对路径，
    // 导致层级里的 stores 目录不会被扫描（表现为 useThemeStore 等自动导入丢失）。
    // 这里改成相对目录名：模块会对每个 layer 的 app 目录分别解析，
    // 宿主与基座的 stores 都能进入自动导入。
    pinia: {
        storesDirs: ['stores']
    },
    evlog: {
        // 事件中的服务名，便于多服务场景区分；业务项目可在自己的配置里覆盖
        env: { service: 'xxdl-admin' },
        // 只对 tRPC 请求生成宽事件，避免 /api/_nuxt_icon/** 等噪音
        include: ['/api/trpc/**']
    },
    // trpc-nuxt 2.1.x 的产物内部使用了 Nuxt 虚拟模块 #imports，
    // 该虚拟模块只能在 Nuxt 构建管线中解析。若不 transpile 该包，
    // Nitro 会把 node_modules 中的 ESM 直接交给 Node 解析，
    // 从而抛出 Package import specifier "#imports" is not defined。
    // 参考：https://github.com/wobsoriano/trpc-nuxt/issues/250
    build: {
        transpile: ['trpc-nuxt']
    },
    runtimeConfig: {
        demoMode: process.env.NUXT_DEMO_MODE === 'true',
        // OpenAPI 文档端点开关（/api/openapi.json、/api/docs）。
        // 默认开启；设置 NUXT_OPENAPI_ENABLED=false 可整体关闭并返回 404。
        openapiEnabled: process.env.NUXT_OPENAPI_ENABLED !== 'false',
        // evlog 文件日志（server/plugins/evlog-drain.ts）的落盘目录。
        // 默认 .data/evlogs/app；.data 已在 .gitignore 中，可用 NUXT_EVLOG_FS_DIR 覆盖。
        evlogFsDir: process.env.EVLOG_FS_DIR ?? '.data/evlogs/app',
        // evlog 文件日志的最低写入等级：trace | debug | info | warn | error | fatal。
        // 低于该等级的事件不落盘；缺省复用项目已有的 LOG_LEVEL，可用 NUXT_EVLOG_FS_LEVEL 覆盖。
        evlogFsLevel: process.env.EVLOG_FS_LEVEL ?? process.env.LOG_LEVEL ?? 'info',
        // 支付渠道密钥的 AES-256-GCM 主密钥：32 字节，base64 或 64 位 hex。
        // 这里必须留空字符串占位，真实值由运行时环境变量 NUXT_PAY_CONFIG_KEY 覆盖
        // （dev 从 .env 读取，生产由部署环境注入），不能把密钥写进仓库。
        payConfigKey: '',
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
        // 数据库连接串（推荐）。设置后优先于下面的分字段配置，
        // 业务项目只需要 `DATABASE_URL=mysql://user:pass@host:3306/db` 一行。
        databaseUrl: '',
        db: {
            host: '',
            // 端口：默认 3306，可用 NUXT_DB_PORT 覆盖（DB_PORT 优先级更高，见 server/drizzle/db.ts）
            port: 3306,
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
        // 服务端打包同样需要 `#admin/*`（Vite 与 Nitro 的别名互不共享）
        alias: {
            '#admin': currentDir
        },
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
    css: [resolve(currentDir, 'app/assets/css/main.css')],
    icon: {
        provider: 'server',
        clientBundle: {
            includeCustomCollections: true
        },
        customCollections: [{
            prefix: 'custom',
            dir: resolve(currentDir, 'app/assets/icons')
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
        // 该选项相对每个 layer 的 rootDir 解析（nuxt-i18n-micro 对每层分别扫描），
        // 因此这里写包内相对路径即可。
        translationDir: 'app/locales',
        // nuxt-i18n-micro 默认会在 pages:resolved 时，为每个页面在
        // <rootDir>/<translationDir>/pages/<路由名>/{en,zh}.json 生成空占位文件。
        // 本项目的翻译集中维护在 en.json / zh.json 两个文件里，不需要页面级拆分，
        // 关闭后可避免每次构建都往源码目录写入几百个空 JSON。
        disablePageLocales: true,
        meta: true,
    },
    echarts: {
        charts: ['BarChart', 'LineChart', 'PieChart'],
        components: ['DatasetComponent', 'GridComponent', 'TooltipComponent', 'LegendComponent'],
    }
})
