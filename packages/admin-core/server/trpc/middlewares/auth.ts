import { AppError } from '#admin/server/utils/appError'

export const authMiddleware = async (opts: any) => {
  const { next, ctx } = opts
  const session = ctx.session ?? await getUserSession(ctx.event)
  // context 已经按 sessionGuard 校验过；这里不要回退到 session.user，
  // 否则被强退的旧 Cookie 会重新变回登录态。
  const user = ctx.user

  if (!user) {
    // 区分“被管理员踢出”和“自然过期”，前端据此给出不同提示
    if (ctx.sessionState?.reason === 'revoked') {
      throw new AppError('auth.sessionKicked')
    }
    if (ctx.sessionState?.reason === 'expired') {
      throw new AppError('auth.sessionExpired')
    }

    throw new AppError('auth.unauthorized')
  }

  return next({
    ctx: {
      ...ctx,
      session,
      user
    }
  })
}
