import { AppError } from '#server/utils/appError'
import { authService } from '#server/sys-router/auth/AuthService'

export function permissionMiddleware(permissionCode: string) {
  return async (opts: any) => {
    const { next, ctx } = opts
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
