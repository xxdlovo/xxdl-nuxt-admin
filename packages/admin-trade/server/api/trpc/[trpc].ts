// 覆盖基座的 tRPC handler：注册「基座 + 电商」合并后的完整路由。
//
// 为什么用「覆盖 handler」而不是让基座 import 电商路由：
// ESM 无法表达可选依赖，而 Nuxt Layer 的覆盖机制只作用于目录扫描，
// 通过同路径文件覆盖是最稳定的接入方式（未安装本层时，基座 handler 生效）。
import { createTRPCNuxtHandler } from 'trpc-nuxt/server'
import { createContext } from '#admin/server/trpc/context'
import { appRouter } from '#trade/server/trpc/routers'

export default createTRPCNuxtHandler({
    endpoint: '/api/trpc',
    router: appRouter,
    createContext
})
