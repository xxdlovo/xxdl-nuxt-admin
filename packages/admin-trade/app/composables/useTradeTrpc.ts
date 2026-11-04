import type { AppRouter } from '#trade/server/trpc/routers'
import { createAdminTrpcClient } from '#admin/app/utils/trpc-client'

/**
 * 电商层的强类型 tRPC 客户端。
 *
 * 为什么不用一个同名插件去 provide：
 * Nuxt 的插件注入属性通过 `defineProperty` 定义为不可重定义，基座已经
 * 注入了 `$trpc`，电商层再 `provide` 会直接抛
 * `Cannot redefine property: $trpc`（整页 500）。
 *
 * 运行时两层用的是**同一个** client 实例（基座注入的那个），它只是按
 * `/api/trpc/<router>.<proc>` 发 HTTP 请求，与路由表的实际内容无关；
 * 真正决定能调哪些接口的是服务端合并后的 handler。
 * 因此这里只做一件事：把实例断言成「包含电商路由」的类型，供电商页面获得
 * 完整的类型提示与校验。
 */
export function useTradeTrpc() {
    return useNuxtApp().$trpc as unknown as ReturnType<typeof createAdminTrpcClient<AppRouter>>
}
