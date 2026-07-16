import { z } from 'zod'
import { publicProcedure, router } from '~~/server/trpc/init'
import { verifyUserPassword } from '#server/utils/password'
import { sysUserService } from '#server/sys-router/user/SysUserService'
import { AppError } from '#server/utils/appError'

const LoginSchema = z.object({
  username: z.string().min(1, 'form.userName.required'),
  password: z.string().min(1, 'form.pwd.required')
})

export const authRouter = router({
  login: publicProcedure.input(LoginSchema).mutation(async ({ ctx, input }) => {
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

    return sessionUser
  }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    await clearUserSession(ctx.event)
    return true
  }),

  me: publicProcedure.query(async ({ ctx }) => {
    const session = await getUserSession(ctx.event)
    return session.user ?? null
  })
})
