import type { AppRouter } from '#admin/server/trpc/routers'
import { createAdminTrpcClient } from '#admin/app/utils/trpc-client'

/**
 * 基座的 tRPC 客户端插件。
 *
 * 只负责把泛型工厂用本层的 AppRouter 类型实例化。
 * 电商层（xxdl-admin-trade）会以自己的同名插件覆盖本文件，
 * 区别仅在于把 AppRouter 换成「基座 + 电商」合并后的路由类型。
 */
export default defineNuxtPlugin(() => {
    const trpc = createAdminTrpcClient<AppRouter>()

    return {
        provide: {
            trpc
        }
    }
})
