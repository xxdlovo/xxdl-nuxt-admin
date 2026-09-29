//#server/sys-router/ossConfig
import { router, proc } from '~~/server/trpc/init'
import { sysOssConfigService } from './SysOssConfigService'
import z from 'zod'
import { SysOssConfigAddSchema, SysOssConfigUpdateSchema, SysOssConfigQuerySchema, SysOssConfigPageQuerySchema } from '#shared/system/ossConfig'

const listProc = proc({ permission: 'system:ossConfig:list' })
const addProc = proc({ permission: 'system:ossConfig:add' })
const editProc = proc({ permission: 'system:ossConfig:edit' })
const delProc = proc({ permission: 'system:ossConfig:del' })

export const sysOssConfigRouter = router({
    create: addProc.input(SysOssConfigAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOssConfigService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysOssConfigService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysOssConfigService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysOssConfigUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOssConfigService(ctx).updateById(input.id, input)
        }),
    verify: editProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysOssConfigService(ctx).verify(input)
        }),
    getOne: listProc.input(SysOssConfigQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysOssConfigService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysOssConfigService(ctx).getById(input)
        }),
    page: listProc.input(SysOssConfigPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysOssConfigService(ctx).page(input)
        })
})
