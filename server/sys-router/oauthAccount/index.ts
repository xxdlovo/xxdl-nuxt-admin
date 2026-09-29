//#server/sys-router/oauthAccount
import { router, proc } from '~~/server/trpc/init'
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
        })
})
