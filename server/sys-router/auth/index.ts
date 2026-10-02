import { z } from 'zod'
import { proc, publicProcedure, protectedProcedure, router } from '~~/server/trpc/init'
import { requireLogin } from '#server/utils/routeGuard'
import {
    SysUserChangePasswordSchema,
    SysUserProfileUpdateSchema,
    SysUserRegisterSchema,
    SysUserSetPasswordSchema
} from '#shared/system/user'
import { authService } from './AuthService'

/**
 * 认证接口。
 *
 * 控制层只做「选过程（public / protected / proc）+ 声明入参 schema + 取会话用户」，
 * 注册开关、账号密码校验、会话写入、登录日志、资料与密码规则全部在 AuthService。
 */
const LoginSchema = z.object({
    username: z.string().min(1, 'form.userName.required'),
    password: z.string().min(1, 'form.pwd.required')
})

export const authRouter = router({
    register: publicProcedure.input(SysUserRegisterSchema)
        .mutation(async ({ ctx, input }) => {
            return await authService(ctx).register(input)
        }),

    login: publicProcedure.input(LoginSchema)
        .mutation(async ({ ctx, input }) => {
            return await authService(ctx).login(input.username, input.password)
        }),

    logout: publicProcedure
        .mutation(async ({ ctx }) => {
            return await authService(ctx).logout()
        }),

    me: publicProcedure
        .query(async ({ ctx }) => {
            return await authService(ctx).me()
        }),

    profile: proc()
        .query(async ({ ctx }) => {
            return await authService(ctx).getRbacProfile(requireLogin(ctx))
        }),

    myProfile: proc()
        .query(async ({ ctx }) => {
            return await authService(ctx).myProfile(requireLogin(ctx))
        }),

    updateProfile: proc().input(SysUserProfileUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return await authService(ctx).updateProfile(requireLogin(ctx), input)
        }),

    changePassword: proc().input(SysUserChangePasswordSchema)
        .mutation(async ({ ctx, input }) => {
            return await authService(ctx).changePassword(requireLogin(ctx), input)
        }),

    setPassword: protectedProcedure.input(SysUserSetPasswordSchema)
        .mutation(async ({ ctx, input }) => {
            return await authService(ctx).setPassword(requireLogin(ctx), input)
        })
})
