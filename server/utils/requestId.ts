import type { H3Event } from 'h3'
import { useLogger } from 'evlog'

/** evlog 写在 event.context 上的宽事件 logger（`useLogger(event)` 的读取目标）。 */
type EventContextWithEvlog = {
  requestId?: unknown
  log?: { getContext?: () => unknown }
}

/**
 * 读取当前请求的 evlog requestId（即宽事件里的 `requestId` 字段）。
 *
 * 一次请求的 requestId 由 evlog 的 Nitro 插件生成，顺序为
 * `cf-ray` → `event.context.requestId` → `crypto.randomUUID()`。
 * 系统操作日志的 `traceId`、`AppError.requestId` 都复用同一个值，
 * 这样 `.data/evlogs` 里的运行日志与 `sys_system_log` / `sys_login_log`
 * 能用同一个 id 互相定位同一次请求。
 *
 * 读取顺序：
 * 1. `useLogger(event).getContext()`（evlog 公开 API，正常路径）；
 * 2. 退回 `event.context.requestId`（evlog 未注册或 logger 未创建时）。
 *
 * 非请求上下文（Nitro 任务、脚本）请用 {@link resolveCurrentRequestId}。
 *
 * @example
 * const requestId = resolveRequestId(ctx.event)
 */
export function resolveRequestId(event?: H3Event | null): string | undefined {
  if (!event) {
    return undefined
  }

  try {
    const context = useLogger(event).getContext() as { requestId?: unknown }

    if (typeof context.requestId === 'string') {
      return context.requestId
    }
  }
  catch {
    // evlog 未初始化（例如模块未注册、logger 尚未创建）时退回 event.context
  }

  // event 也可能是单元测试里的伪对象（只有 node/headers），这里一并做保护
  const fallback = (event.context as EventContextWithEvlog | undefined)?.requestId

  return typeof fallback === 'string' ? fallback : undefined
}

/**
 * 在任意服务端代码里读取当前请求的 requestId。
 *
 * 依赖 Nitro 的 AsyncLocalStorage（`useEvent()` 由 Nitro 自动导入），
 * 因此适用于拿不到 H3Event 的场景，例如 AppError 的构造函数。
 * 脱离请求上下文（定时任务、直接运行的脚本、单元测试）时返回 `undefined`。
 */
export function resolveCurrentRequestId(): string | undefined {
  try {
    // useEvent 由 Nitro 注入；非 Nitro 运行时它不存在，用 typeof 探测避免 ReferenceError
    const event = typeof useEvent === 'function' ? useEvent() : undefined

    return resolveRequestId(event)
  }
  catch {
    return undefined
  }
}
