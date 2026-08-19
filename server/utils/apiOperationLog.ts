import type { H3Event } from 'h3'
import { getMethod, getRequestURL } from 'h3'
import type { Context } from '#server/trpc/context'
import { logRecorder } from '#server/sys-router/systemLog/LogRecorderService'

type ApiOperationLogOptions = {
  action?: string
  requestParams?: unknown
  requestResult?: unknown
}

function getApiRequestMeta(event: H3Event) {
  return {
    method: getMethod(event),
    path: getRequestURL(event).pathname,
  }
}

function getApiLogMessage(
  event: H3Event,
  status: 'success' | 'failed',
  durationMs: number,
  action?: string,
) {
  const { method, path } = getApiRequestMeta(event)
  const operation = action ? `${method} ${path} ${action}` : `${method} ${path}`
  return `${operation} ${status} ${durationMs}ms`
}

/**
 * Records operation logs for Nitro server/api handlers.
 *
 * tRPC requests go through loggerMiddleware automatically; plain server/api
 * handlers do not, so they can use this helper while keeping method/path
 * derived from the actual H3 event.
 */
export function apiOperationLog(ctx: Context, module: string, start = Date.now()) {
  const event = ctx.event

  return {
    async success(options: ApiOperationLogOptions = {}) {
      const durationMs = Date.now() - start
      const { method, path } = getApiRequestMeta(event)

      await logRecorder(ctx).systemSuccess(
        module,
        getApiLogMessage(event, 'success', durationMs, options.action),
        {
          requestMethod: method,
          requestPath: path,
          durationMs,
          requestParams: options.requestParams,
          requestResult: options.requestResult,
        }
      )
    },

    async failure(error?: unknown, options: ApiOperationLogOptions = {}) {
      const durationMs = Date.now() - start
      const { method, path } = getApiRequestMeta(event)

      await logRecorder(ctx).systemFailure(
        module,
        error,
        getApiLogMessage(event, 'failed', durationMs, options.action),
        {
          requestMethod: method,
          requestPath: path,
          durationMs,
          requestParams: options.requestParams,
        }
      )
    },
  }
}
