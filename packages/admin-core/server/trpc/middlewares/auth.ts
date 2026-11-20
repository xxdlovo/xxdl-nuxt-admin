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

  // 登录态确认后一次性解析能力档案：
  // - assertEntitlement 直接读 ctx.entitlements，不再重复查数据源；
  // - auth.profile 复用同一份解析结果，避免同一请求解析两次。
  // 这里必须用 Nitro 的 server/utils 自动导入调用 resolveEntitlements：
  // 显式 `#admin/server/utils/entitlementSource` 会写死基座实现，
  // 安装 xxdl-admin-trade 后它的同名文件就不会覆盖生效。
  ctx.entitlements = await resolveEntitlements(ctx)

  return next({
    ctx: {
      ...ctx,
      session,
      user,
      entitlements: ctx.entitlements
    }
  })
}
