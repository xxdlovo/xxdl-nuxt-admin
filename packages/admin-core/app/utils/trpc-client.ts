import { createTRPCNuxtClient, httpLink } from 'trpc-nuxt/client'
import { TRPCClientError } from '@trpc/client'
import type { TRPCLink } from '@trpc/client'
import type { AnyRouter } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import type { TRPCFormattedError } from '#admin/shared/types/common'
import { copyToClipboard } from '#admin/app/utils/clipboard'

/**
 * tRPC 客户端工厂。
 *
 * 抽成泛型工厂的原因：基座（core）与电商层（trade）的路由集合不同，
 * 但客户端行为（错误提示、requestId 复制、locale 请求头）完全一致。
 * 两层各自只写一个 5 行的 plugin，把本函数用「自己的 AppRouter 类型」实例化，
 * 避免复制整段错误处理逻辑。
 *
 * 注意：本函数必须在 Nuxt 插件 setup 上下文内调用（内部使用 useToast/useI18n）。
 */
export function createAdminTrpcClient<TRouter extends AnyRouter>() {
    const toast = useToast()
    const { $ts } = useI18n()

    /** 错误对象的扩展类型（后端 errorFormatter 会带上 requestId，见 server/trpc/errorFormatter.ts） */
    type TypedTRPCError = TRPCClientError<TRouter> & {
        data: TRPCFormattedError
    }

    /** 复制 requestId 并提示成功 */
    async function copyRequestId(value: string) {
        const succeeded = await copyToClipboard(value)

        if (succeeded) {
            toast.add({ title: $ts('common.copySuccess'), color: 'success' })
        }
    }

    /**
     * 异常处理 link。
     *
     * 这里直接用工厂里捕获的 toast / $ts：错误回调是异步的，
     * 在里面再次调用 useToast() / useI18n() 会拿不到 Nuxt 上下文。
     */
    const customLink: TRPCLink<TRouter> = () => {
        return ({ next, op }) => {
            return observable((observer) => {
                const unsubscribe = next(op).subscribe({
                    next(value) {
                        observer.next(value)
                    },
                    error(err: TRPCClientError<TRouter>) {
                        const typedErr = err as TypedTRPCError

                        /**
                         * 会话被撤销（在线用户强退 / 账号被禁用）：
                         * Cookie 可能还在，但服务端已经拒绝；这里清掉本地会话并回登录页，
                         * 避免页面停留在“看起来已登录、所有请求都报错”的状态。
                         */
                        if (typedErr.data?.code === 'UNAUTHORIZED' && import.meta.client) {
                            const path = window.location.pathname
                            if (!path.startsWith('/login')) {
                                void $fetch('/api/_auth/session', { method: 'DELETE' }).catch(() => {})
                                const reason = typedErr.data?.i18nKey === 'auth.sessionKicked'
                                    ? 'kicked'
                                    : 'expired'
                                const params = new URLSearchParams({
                                    reason,
                                    redirect: `${path}${window.location.search}`
                                })
                                window.location.assign(`/login?${params.toString()}`)
                            }
                            observer.error(err)
                            return
                        }

                        // requestId 由后端 errorFormatter 带出（evlog 宽事件的 id，见 server/utils/requestId.ts）
                        const requestId = typedErr.data?.requestId

                        // 报错前先清空
                        toast.clear()

                        // 错误信息已在服务端翻译好，直接使用
                        const description = typedErr.message || 'Unknown error'

                        toast.add({
                            title: typedErr.data?.type,
                            // 展示 requestId 并提供一键复制：用户报障时可直接提供该 id，
                            // 便于在 .data/evlogs 运行日志与 sys_system_log 里检索同一次请求
                            description: requestId
                                ? `${description} (${$ts('common.requestId')}: ${requestId})`
                                : description,
                            color: 'error',
                            actions: requestId
                                ? [{
                                    label: $ts('common.copyRequestId'),
                                    icon: 'i-lucide-copy',
                                    onClick: () => copyRequestId(requestId)
                                }]
                                : undefined
                        })

                        observer.error(err)
                    },
                    complete() {
                        observer.complete()
                    }
                })

                return unsubscribe
            })
        }
    }

    /** 默认请求头：把当前语言带给服务端，用于服务端错误信息翻译 */
    function getHeader() {
        const locale = useCookie<string>('i18n_locale').value || 'en'

        return {
            'x-locale': locale,
            'accept-language': locale
        }
    }

    return createTRPCNuxtClient<TRouter>({
        // 使用 httpLink：一次调用一个请求，不做批量合并
        links: [customLink, httpLink({
            url: '/api/trpc',
            headers: () => getHeader(),
            fetch(url, options) {
                return fetch(url, {
                    ...options,
                    credentials: 'include'
                })
            }
        })]
    })
}
