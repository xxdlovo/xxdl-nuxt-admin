/**
 * nitro 路由（server/api/**）的准入校验。
 *
 * tRPC 的「登录 + 权限」由中间件负责，原生路由没有这层，
 * 统一收在这里，避免每个路由各写一份「是不是管理员 / 有没有权限码」的判断。
 */
import type { AuthUser, Context } from '#server/trpc/context'
import { authService } from '#server/sys-router/auth/AuthService'
import { AppError } from '#server/utils/appError'

/** 必须已登录，返回当前用户（同步：只做会话判断与类型收敛） */
export function requireLogin(ctx: Context): AuthUser {
  if (!ctx.user) {
    throw new AppError('auth.unauthorized')
  }

  return ctx.user
}

/** 必须已登录且拥有指定权限码（管理员直接放行，与 tRPC 的 permissionMiddleware 规则一致） */
export async function requirePermission(ctx: Context, permissionCode: string): Promise<AuthUser> {
  const user = requireLogin(ctx)

  if (user.isAdmin === 1) {
    return user
  }

  const permissionCodes = await authService(ctx).listPermissionCodes(user)

  if (!permissionCodes.includes(permissionCode)) {
    throw new AppError('auth.forbidden')
  }

  return user
}
