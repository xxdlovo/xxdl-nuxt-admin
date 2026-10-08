import { useLogger } from 'evlog'
import type { RequestLogger } from 'evlog'

/** 业务日志只需用到的几个方法。 */
type SafeLogger = Pick<RequestLogger, 'set' | 'info' | 'warn' | 'error'>

/**
 * 没有请求上下文时使用的空 logger。
 *
 * domain 服务（`walletService(db)`、`orderService(db)` 等）会被定时任务、
 * 后台脚本直接调用，那里没有 Nitro event；此时日志必须静默跳过，
 * 不能抛错影响资金逻辑。
 */
const noopLogger: SafeLogger = {
    set: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
}

/**
 * 取当前请求的 evlog logger，供**拿不到 `ctx`** 的服务使用。
 *
 * `server/` 目录下的 `*Service.ts`（tRPC 模块层）直接接收 `ctx`，用
 * `useLogger(ctx.event, service)` 即可；而 `server/trade-router/domain/**`
 * 这类领域服务的入参是 `db` / `executor`，只能通过 Nitro 的
 * AsyncLocalStorage（`useEvent()`）反查当前请求：
 *
 * - 处于请求链路内（含 `db.transaction(...)` 回调）→ 返回真实 logger，日志并入同一条宽事件；
 * - 脱离请求上下文（定时任务、脚本、单测）→ 返回空实现，调用点无需判空。
 *
 * @example
 * const log = resolveLogger('server/trade-router/wallet')
 * log.info('wallet credited', { wallet: { action: 'credit', userId, amount } })
 */
export function resolveLogger(service: string): SafeLogger {
    try {
        // useEvent 由 Nitro 自动导入；非 Nitro 运行时不存在，用 typeof 探测避免 ReferenceError
        const event = typeof useEvent === 'function' ? useEvent() : undefined

        return event ? useLogger(event, service) : noopLogger
    }
    catch {
        return noopLogger
    }
}
