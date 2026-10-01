/**
 * 业务错误类
 * 抛出 i18n key，由 errorFormatter 自动翻译后返回给客户端
 *
 * @example
 * throw new AppError('user.notFound')
 * // 客户端收到翻译后的消息: "用户不存在"
 *
 * @example
 * throw new AppError('form.userName.required')
 * // 客户端收到翻译后的消息: "请输入用户名"
 */
export class AppError extends Error {
  /**
   * @param i18nKey - 国际化 key，如 'form.userName.required'
   * @param options  - 可选参数，如自定义 message 或 cause
   */
  constructor(
    public readonly i18nKey: string,
    options?: { message?: string; cause?: unknown }
  ) {
    super(options?.message ?? i18nKey, { cause: options?.cause })
    this.name = 'AppError'
  }
}

/**
 * AppError → HTTP 状态与 tRPC 错误码的统一映射。
 *
 * 业务错误必须映射到 4xx：前端可据此按 code 分支，
 * 监控与网关也能把「请求有问题」和「服务端异常」分开统计，
 * 而不是把所有业务失败都算成 5xx。
 *
 * 这份映射同时被两处使用，避免规则漂移：
 * - tRPC：server/trpc/errorFormatter.ts
 * - 原生路由：server/api/**（手工映射，见 doc/main/3.backend-handbook/7.api-routes.md）
 */
export const APP_ERROR_STATUS_MAP: Record<string, { code: string; httpStatus: number }> = {
  // 未登录：前端据此跳转登录页
  'auth.unauthorized': { code: 'UNAUTHORIZED', httpStatus: 401 },
  // 已登录但缺少权限码
  'auth.forbidden': { code: 'FORBIDDEN', httpStatus: 403 },
  // demo 模式下的写操作保护，语义上是「禁止」，用 403 而不是 500
  'system.demoReadonly': { code: 'FORBIDDEN', httpStatus: 403 },
  // 查询目标不存在：例如 getOne/getById 未命中
  'common.notExist': { code: 'NOT_FOUND', httpStatus: 404 }
}

/** 未在映射表中登记的业务错误一律按「请求有误」处理。 */
export const DEFAULT_APP_ERROR_STATUS = { code: 'BAD_REQUEST', httpStatus: 400 }

export function resolveAppErrorStatus(i18nKey: string) {
  return APP_ERROR_STATUS_MAP[i18nKey] ?? DEFAULT_APP_ERROR_STATUS
}
