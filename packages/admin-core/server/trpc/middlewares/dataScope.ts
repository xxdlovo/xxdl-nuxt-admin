/**
 * 参数化的数据权限中间件。
 *
 * applied 为 false 时，把「跳过数据权限过滤」标记写入 ctx，
 * 由 buildScope 据此决定是否叠加数据范围条件。
 * 这样就不需要在 buildScope 里硬编码权限码白名单。
 */
export function dataScopeMiddleware(applied: boolean) {
  return async (opts: any) => {
    if (!applied) {
      opts.ctx.skipDataScope = true
    }

    return opts.next()
  }
}
