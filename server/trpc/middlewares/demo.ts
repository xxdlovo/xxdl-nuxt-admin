import { AppError } from '#server/utils/appError'

/**
 * demo 只读保护的参数化中间件。
 *
 * enabled 由 proc() 计算得出（该接口声明了 readonly 且当前处于 demo 模式），
 * 因此这里只负责「命中即拦截」，不再重复判断环境变量。
 */
export function demoReadonlyMiddleware(enabled: boolean) {
  return async (opts: any) => {
    if (!enabled) {
      return opts.next()
    }

    throw new AppError('system.demoReadonly')
  }
}
