// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: {enabled: true},
    modules: ['@nuxt/ui'],
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
})