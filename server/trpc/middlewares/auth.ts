import { AppError } from '#server/utils/appError'

export const authMiddleware = async (opts: any) => {
  const { next, ctx } = opts
  const session = ctx.user ? ctx.session : await getUserSession(ctx.event)
  const user = ctx.user ?? session.user

  if (!user) {
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
