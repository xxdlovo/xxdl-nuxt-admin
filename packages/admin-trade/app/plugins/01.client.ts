import type { AppRouter } from '#trade/server/trpc/routers'
import { createAdminTrpcClient } from '#admin/app/utils/trpc-client'

/**
 * 覆盖基座的 tRPC 客户端插件。
 *
 * 与基座版本唯一的区别：AppRouter 使用「基座 + 电商」合并后的路由类型，
 * 使电商域页面能拿到完整的类型提示与校验。
 */
export default defineNuxtPlugin(() => {
    const trpc = createAdminTrpcClient<AppRouter>()

    return {
        provide: {
            trpc
        }
    }
})
