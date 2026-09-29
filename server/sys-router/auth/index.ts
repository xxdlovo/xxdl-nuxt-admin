import { z } from 'zod'
import { proc, publicProcedure, protectedProcedure, router } from '~~/server/trpc/init'
import { verifyUserPassword, isPlaceholderPassword } from '#server/utils/password'
import { sysUserService } from '#server/sys-router/user/SysUserService'
import { AppError } from '#server/utils/appError'
import {
    SysUserChangePasswordSchema,
    SysUserProfileUpdateSchema,
    SysUserRegisterSchema,
    SysUserSetPasswordSchema
} from '#shared/system/user'
import { systemRegisterEnum } from '#shared/constants/business'
import { sysConfigService } from '#server/sys-router/config/SysConfigService'
import { authService } from './AuthService'
import { logRecorder } from '#server/sys-router/systemLog/LogRecorderService'

const LoginSchema = z.object({
    username: z.string().min(1, 'form.userName.required'),
    password: z.string().min(1, 'form.pwd.required')
})

export const authRouter = router({
    register: publicProcedure.input(SysUserRegisterSchema).mutation(async ({ ctx, input }) => {
        const value = await sysConfigService(ctx).getValueByKey(systemRegisterEnum.key)
        if (value !== systemRegisterEnum.yes) {
            throw new AppError('auth.registerDisabled')
        }

        return sysUserService(ctx).register(input)
    }),

    login: publicProcedure.input(LoginSchema).mutation(async ({ ctx, input }) => {
        try {
            const user = await sysUserService(ctx).getLoginUserByUsername(input.username)

            if (!user || user.status !== 1) {
                throw new AppError('auth.userIsBlock')
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
                deptId: user.deptId,
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

    profile: proc().query(async ({ ctx }) => {
        if (!ctx.user) {
            throw new AppError('auth.unauthorized')
        }

        return authService(ctx).getRbacProfile(ctx.user)
    }),

    myProfile: proc().query(async ({ ctx }) => {
        if (!ctx.user) {
            throw new AppError('auth.unauthorized')
        }

        const current = await sysUserService(ctx).getById(ctx.user.id)
        // getById 已剔除 password，这里额外补一个状态位：
        // 前端据此决定密码表单是「设置新密码」（无需原密码）
        // 还是「修改密码」（必须输入原密码）。
        const passwordStatus = await sysUserService(ctx).getPasswordStatus(ctx.user.id)

        return {
            ...(current ?? {}),
            hasPassword: passwordStatus?.hasPassword ?? true
        }
    }),

    updateProfile: proc().input(SysUserProfileUpdateSchema).mutation(async ({ ctx, input }) => {
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
            deptId: currentUser.deptId ?? null,
            isAdmin: currentUser.isAdmin ?? ctx.user.isAdmin ?? null
        }

        await setUserSession(ctx.event, {
            user: nextUser,
            loggedInAt: ctx.session.loggedInAt
        })

        ctx.user = nextUser
        return nextUser
    }),

    changePassword: proc().input(SysUserChangePasswordSchema).mutation(async ({ ctx, input }) => {
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
    }),

    /**
     * 设置 / 修改密码。
     *
     * 行为取决于用户是否已经设置过密码（由 sys_user.password 是否为占位标记判断）：
     * - 从未设置过（OAuth 建号用户）：直接设置新密码，无需原密码 —— 库中的占位标记
     *   对用户不可知，要求原密码没有意义；
     * - 已设置过真实密码：必须提供并校验原密码，恢复原有的修改密码保护。
     *
     * 该校验放在服务端而不是依赖前端分支：否则任何登录用户都能直接调用本接口
     * 绕过原密码校验，等于废掉原有保护。
     */
    setPassword: protectedProcedure.input(SysUserSetPasswordSchema).mutation(async ({ ctx, input }) => {
        if (!ctx.user) {
            throw new AppError('auth.unauthorized')
        }

        const current = await sysUserService(ctx).getLoginUserByUsername(ctx.user.username)
        if (!current || current.id !== ctx.user.id) {
            throw new AppError('common.notExist')
        }

        // 已设置过密码 → 必须校验原密码
        if (!isPlaceholderPassword(current.password)) {
            if (!input.oldPassword) {
                throw new AppError('auth.oldPasswordRequired')
            }

            const validPassword = await verifyUserPassword(current.password, input.oldPassword)
            if (!validPassword) {
                throw new AppError('auth.invalidCredentials')
            }
        }

        return sysUserService(ctx).resetPassword({
            id: ctx.user.id,
            password: input.password,
            confirmPassword: input.confirmPassword
        })
    })
})
