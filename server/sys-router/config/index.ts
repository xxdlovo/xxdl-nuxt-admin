import z from 'zod'
import { publicProcedure, router, proc } from '~~/server/trpc/init'
import { SysConfigAddSchema, SysConfigPageQuerySchema, SysConfigQuerySchema, SysConfigUpdateSchema } from '#shared/system/config'
import { sysConfigService } from './SysConfigService'

const listProc = proc({ permission: 'system:config:list' })
const addProc = proc({ permission: 'system:config:add' })
const editProc = proc({ permission: 'system:config:edit' })
const delProc = proc({ permission: 'system:config:del' })

export const sysConfigRouter = router({
    create: addProc.input(SysConfigAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysConfigService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysConfigService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysConfigService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysConfigUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysConfigService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysConfigQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysConfigService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysConfigService(ctx).getById(input)
        }),
    getValueByKey: publicProcedure.input(z.string().min(1, 'form.required'))
        .query(async ({ ctx, input }) => {
            return sysConfigService(ctx).getValueByKey(input)
        }),
    page: listProc.input(SysConfigPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysConfigService(ctx).page(input)
        })
})
