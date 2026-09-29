import { AppError } from '#server/utils/appError'
import { authService } from '#server/sys-router/auth/AuthService'

export function permissionMiddleware(permissionCode?: string) {
  return async (opts: any) => {
    const { next, ctx } = opts

    // 未声明权限码时只要求登录（由 authMiddleware 保证），不做权限校验
    if (!permissionCode) {
      return next()
    }

    const user = ctx.user

    ctx.currentPermissionCode = permissionCode

    if (!user) {
      throw new AppError('auth.unauthorized')
    }

    if (user.isAdmin === 1) {
      return next()
    }

    if (!ctx.permissionCodes) {
      ctx.permissionCodes = await authService(ctx).listPermissionCodes(user)
    }

    if (!ctx.permissionCodes.includes(permissionCode)) {
      throw new AppError('auth.forbidden')
    }

    return next()
  }
}
