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

/** 依赖包或运行时内部的栈帧：对业务排查没有增量信息。 */
const INTERNAL_FRAME_RE = /(?:^|[/\\])node_modules(?:[/\\]|$)|node:/

/**
 * 精简错误堆栈，供写日志时使用。
 *
 * 直接把 `Error` 交给 evlog 时，drizzle / mysql2 / tRPC 会带出几十帧内部堆栈
 *（全是 `node_modules` 与 `node:` 帧），既撑大日志文件又没有排查价值。
 * evlog 自带的压缩只在堆栈里存在「业务帧」时生效，而 dev 下业务代码被打包进
 * `.nuxt/dev/index.mjs`、库内部错误又几乎没有业务帧，所以这里显式处理：
 *
 * - 优先保留业务帧（非依赖、非运行时内部），最多 `maxFrames` 帧；
 * - 一个业务帧都没有时退回保留前 `maxFrames` 帧；
 * - 其余折叠成 `... N frame(s) hidden` 一行。
 *
 * @example
 * log.error(summary, { database: { sql, code } })
 */
export function compactErrorStack(error: unknown, maxFrames = 3): string | undefined {
    const stack = error instanceof Error ? error.stack : undefined

    if (!stack) {
        return undefined
    }

    const lines = stack.split('\n')
    const head = lines[0]?.trim() || 'Error'
    // 只把 `at ` 开头的行当作帧：V8 的栈首行是 message，后面可能还有 `params:` 之类的续行
    const frames = lines.slice(1).map(line => line.trim()).filter(line => line.startsWith('at '))
    const appFrames = frames.filter(frame => !INTERNAL_FRAME_RE.test(frame))
    const picked = (appFrames.length > 0 ? appFrames : frames).slice(0, maxFrames)
    const hidden = frames.length - picked.length

    return [
        head,
        ...picked.map(frame => `    ${frame}`),
        hidden > 0 ? `    ... ${hidden} frame(s) hidden` : ''
    ].filter(Boolean).join('\n')
}
