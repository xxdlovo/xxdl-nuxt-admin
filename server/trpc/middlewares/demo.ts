import { AppError } from '#server/utils/appError'

/**
 * demo 只读保护的参数化中间件。
 *
 * enabled 由 proc() 计算得出（当前处于 demo 模式，或该接口显式声明 readonly），
 * 这里只负责「命中即拦截」，不再重复判断环境变量。
 *
 * 只拦截 mutation：
 * demo 模式的目的是「防止演示数据被改动」，而 query 本身不会写库。
 * 若连 query 一起拦，像 auth.profile 这类只读接口会直接失败，
 * 导致个人中心、RBAC 权限等基础功能在演示模式下不可用。
 * 判定方式与 loggerMiddleware 保持一致（opts.type）。
 *
 * 注意：显式 proc({ readonly: true }) 声明在 query 上时同样会被放行，
 * 因此不要把「有副作用的写操作」声明为 query。
 */
export function demoReadonlyMiddleware(enabled: boolean) {
  return async (opts: any) => {
    if (!enabled) {
      return opts.next()
    }

    // 读操作放行
    if (opts.type === 'query') {
      return opts.next()
    }

    throw new AppError('system.demoReadonly')
  }
}
