//#server/sys-router/oauthConfig
import { router, proc } from '~~/server/trpc/init'
import { sysOauthConfigService } from './SysOauthConfigService'
import z from 'zod'
import {
    SysOauthConfigAddSchema,
    SysOauthConfigUpdateSchema,
    SysOauthConfigQuerySchema,
    SysOauthConfigPageQuerySchema
} from '#shared/system/oauthConfig'

const listProc = proc({ permission: 'system:oauthConfig:list' })
const addProc = proc({ permission: 'system:oauthConfig:add' })
const editProc = proc({ permission: 'system:oauthConfig:edit' })
const delProc = proc({ permission: 'system:oauthConfig:del' })

export const sysOauthConfigRouter = router({
    create: addProc.input(SysOauthConfigAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOauthConfigService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysOauthConfigService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysOauthConfigService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysOauthConfigUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOauthConfigService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysOauthConfigQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysOauthConfigService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysOauthConfigService(ctx).getById(input)
        }),
    page: listProc.input(SysOauthConfigPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysOauthConfigService(ctx).page(input)
        })
})
