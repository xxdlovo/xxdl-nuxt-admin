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
