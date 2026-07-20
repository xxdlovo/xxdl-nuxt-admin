import { z } from 'zod'
import { protectedProcedure, publicProcedure, router } from '~~/server/trpc/init'
import { verifyUserPassword } from '#server/utils/password'
import { sysUserService } from '#server/sys-router/user/SysUserService'
import { AppError } from '#server/utils/appError'
import { SysUserChangePasswordSchema, SysUserProfileUpdateSchema } from '#shared/system/user'
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
        email: user.email,
        nickname: user.nickname,
        avatar: user.avatar,
        phone: user.phone,
        gender: user.gender,
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
  }),

  myProfile: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      throw new AppError('auth.unauthorized')
    }

    return sysUserService(ctx).getById(ctx.user.id)
  }),

  updateProfile: protectedProcedure.input(SysUserProfileUpdateSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.user) {
      throw new AppError('auth.unauthorized')
    }

    const currentUser = await sysUserService(ctx).getById(ctx.user.id)
    if (!currentUser?.id || !currentUser.username) {
      throw new AppError('common.notExist')
    }

    await sysUserService(ctx).updateById(ctx.user.id, {
      id: ctx.user.id,
      username: currentUser.username,
      email: input.email,
      nickname: input.nickname || null,
      avatar: input.avatar || null,
      phone: input.phone || null,
      gender: input.gender ?? null,
      deptId: currentUser.deptId ?? null,
      status: currentUser.status ?? 1,
      remark: input.remark || null
    })

    const nextUser = {
      id: ctx.user.id,
      username: currentUser.username,
      email: input.email,
      nickname: input.nickname || null,
      avatar: input.avatar || null,
      phone: input.phone || null,
      gender: input.gender ?? null,
      isAdmin: currentUser.isAdmin ?? ctx.user.isAdmin ?? null
    }

    await setUserSession(ctx.event, {
      user: nextUser,
      loggedInAt: ctx.session.loggedInAt
    })

    ctx.user = nextUser
    return nextUser
  }),

  changePassword: protectedProcedure.input(SysUserChangePasswordSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.user) {
      throw new AppError('auth.unauthorized')
    }

    const user = await sysUserService(ctx).getLoginUserByUsername(ctx.user.username)
    if (!user || user.id !== ctx.user.id) {
      throw new AppError('common.notExist')
    }

    const validPassword = await verifyUserPassword(user.password, input.oldPassword)
    if (!validPassword) {
      throw new AppError('auth.invalidCredentials')
    }

    return sysUserService(ctx).resetPassword({
      id: ctx.user.id,
      password: input.password,
      confirmPassword: input.confirmPassword
    })
  })
})
