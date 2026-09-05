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
        'app:resolve'(app) {
            for (const [name, layout] of Object.entries(app.layouts)) {
                if (layout.file.replace(/\\/g, '/').includes('/app/layouts/modules/')) {
                    delete app.layouts[name]
                }
            }
        }
    },
    modules: ['@nuxt/ui', 'nuxt-echarts', 'nuxt-i18n-micro', 'nuxt-auth-utils', '@pinia/nuxt', 'motion-v/nuxt','pinia-plugin-persistedstate/nuxt'],
    devServer: {
        host: '0.0.0.0',
        port: 3001
    },
    runtimeConfig: {
        demoMode: process.env.NUXT_DEMO_MODE === 'true',
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
