// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: {enabled: true},
    ssr: false,
    modules: ['@nuxt/ui', 'nuxt-echarts','nuxt-i18n-micro'],
    runtimeConfig:{
        db:{
            host: process.env.DB_HOST!,
            user:  process.env.DB_USER!,
            password: process.env.DB_PASSWORD!,
            database:  process.env.DB_DATABASE!,
        },
        // 客户端可访问的环境变量
        public: {
            appName: 'Nuxt Admin System'
        }
    },
    ui: {
        // 关闭谷歌字体
        fonts: false
    },
    css: ['~/assets/css/main.css'],
    i18n: {
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
        components: ['DatasetComponent', 'GridComponent','TooltipComponent', 'LegendComponent'],
    }
})