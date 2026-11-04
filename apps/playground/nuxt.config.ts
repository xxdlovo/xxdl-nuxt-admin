// ============================================================================
// 最小接入示例（playground）
//
// 这个目录刻意保持「只有配置、没有业务代码」，用来回答两个问题：
//
//   1. 业务项目接入基座到底需要写什么？—— 就是下面这些，别的都不用写。
//   2. 基座升级后，一个干净的宿主还能不能跑起来？—— CI 与本地回归都跑它。
//
// 目录里没有 app/ 也没有 server/：页面、组件、composable、store、tRPC 路由、
// Drizzle 数据访问、RBAC、主题、i18n 全部来自 layer。
//
// 需要额外业务模块时，在自己项目里新建：
//   app/pages/system/<module>/index.vue      —— 页面（自动扫描，与基座页面同级）
//   server/admin-router/<module>.ts          —— 可选：把自己的 router 并入
// ============================================================================
export default defineNuxtConfig({
    // 只想要系统管理：改成 ['../../packages/admin-core'] 即可，不安装电商层。
    extends: ['../../packages/admin-trade'],

    compatibilityDate: '2025-07-15',

    // 后台是 SPA：主题、标签页、侧边栏状态都直接读写 localStorage。
    // 基座已对 /system/** 单独关闭 SSR，这里保持一致。
    ssr: false,

    devServer: {
        host: '0.0.0.0',
        port: 3002
    },

    routeRules: {
        // 基座不提供 `/` 页面（首页属于业务）。这里把根路径导到登录页，
        // 让 playground 打开即可用；真实项目通常换成自己的首页。
        '/': { redirect: '/login' }
    }
})
