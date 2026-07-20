import { z } from 'zod'
import { protectedProcedure, publicProcedure, router } from '~~/server/trpc/init'
import { verifyUserPassword } from '#server/utils/password'
import { sysUserService } from '#server/sys-router/user/SysUserService'
import { AppError } from '#server/utils/appError'
import { authService } from './AuthService'
import { logRecorder } from '#server/sys-router/systemLog/LogRecorderService'

const LoginSchema = z.object({
  username: z.string().min(1, 'form.userName.required'),
  password: z.string().min(1, 'form.pwd.required')
})

export const authRouter = router({
  login: publicProcedure.input(LoginSchema).mutation(async ({ ctx, input }) => {
    try {
      const user = await sysUserService(ctx).getLoginUserByUsername(input.username)

      if (!user || user.status !== 1) {
        throw new AppError('auth.invalidCredentials')
      }

      const validPassword = await verifyUserPassword(user.password, input.password)

      if (!validPassword) {
        throw new AppError('auth.invalidCredentials')
      }

      const sessionUser = {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        isAdmin: user.isAdmin
      }

      await setUserSession(ctx.event, {
        user: sessionUser,
        loggedInAt: new Date().toISOString()
      })

      ctx.user = sessionUser
      await logRecorder(ctx).loginSuccess()

      return sessionUser
    }
    catch (error) {
      await logRecorder(ctx).loginFailure(input.username, 'login failure', error)
      throw error
    }
  }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    await clearUserSession(ctx.event)
    return true
  }),

  me: publicProcedure.query(async ({ ctx }) => {
    const session = await getUserSession(ctx.event)
    return session.user ?? null
  }),

  profile: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      throw new AppError('auth.unauthorized')
    }
    return authService(ctx).getRbacProfile(ctx.user)
  })
})
