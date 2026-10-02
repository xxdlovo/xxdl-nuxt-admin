/**
 * 原生路由（server/api/**）的业务错误 → H3 错误。
 *
 * 与 tRPC 的 errorFormatter 共用同一份 AppError 状态映射（server/utils/appError.ts），
 * 避免「业务错误映射到 4xx」的规则在两处漂移；调用方不再手写三元表达式。
 */
import { AppError, resolveAppErrorStatus } from '#server/utils/appError'

export type ApiRouteTranslator = (i18nKey: string) => string

/**
 * 计算要返回给客户端的状态码与文案。
 *
 * @param error        捕获到的异常（通常是 AppError）
 * @param t            服务端翻译函数（createServerT(event)）
 * @param fallbackKey  非 AppError 且拿不到 message 时的兜底文案 key
 */
export function resolveApiRouteError(
  error: unknown,
  t: ApiRouteTranslator,
  fallbackKey: string
): { statusCode: number; message: string } {
  const statusCode = error instanceof AppError
    ? resolveAppErrorStatus(error.i18nKey).httpStatus
    : 500

  const message = error instanceof AppError
    ? t(error.i18nKey)
    : error instanceof Error
      ? error.message
      : t(fallbackKey)

  return { statusCode, message }
}

/** 直接构造可抛出的 H3 错误 */
export function createApiRouteError(error: unknown, t: ApiRouteTranslator, fallbackKey: string) {
  const { statusCode, message } = resolveApiRouteError(error, t, fallbackKey)

  return createError({
    statusCode,
    statusMessage: message,
    message
  })
}
