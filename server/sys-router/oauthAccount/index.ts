//#server/sys-router/oauthAccount
import { router, proc, protectedProcedure } from '~~/server/trpc/init'
import { AppError } from '#server/utils/appError'
import { sysOauthAccountService } from './SysOauthAccountService'
import z from 'zod'
import {
    SysOauthAccountAddSchema,
    SysOauthAccountUpdateSchema,
    SysOauthAccountQuerySchema,
    SysOauthAccountPageQuerySchema
} from '#shared/system/oauthAccount'

const listProc = proc({ permission: 'system:oauthAccount:list' })
const addProc = proc({ permission: 'system:oauthAccount:add' })
const editProc = proc({ permission: 'system:oauthAccount:edit' })
const delProc = proc({ permission: 'system:oauthAccount:del' })

export const sysOauthAccountRouter = router({
    create: addProc.input(SysOauthAccountAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOauthAccountService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysOauthAccountService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysOauthAccountService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysOauthAccountUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOauthAccountService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysOauthAccountQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysOauthAccountService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysOauthAccountService(ctx).getById(input)
        }),
    page: listProc.input(SysOauthAccountPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysOauthAccountService(ctx).page(input)
        }),

    // 以下两个接口面向「当前登录用户自己」，只需登录态、不要求管理权限，
    // 因此所有用户都能在个人中心查看并解绑自己的第三方账号。
    myBindings: protectedProcedure
        .query(async ({ ctx }) => {
            return sysOauthAccountService(ctx).listMyBindings()
        }),
    removeMyBinding: protectedProcedure.input(z.string())
        .mutation(async ({ ctx, input }) => {
            if (!ctx.user) {
                throw new AppError('auth.unauthorized')
            }
            return sysOauthAccountService(ctx).removeMyBinding(input, ctx.user.id)
        })
})
