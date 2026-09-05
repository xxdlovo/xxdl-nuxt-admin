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
