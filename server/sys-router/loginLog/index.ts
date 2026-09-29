//#server/sys-router/loginLog
import { router, proc } from '~~/server/trpc/init'
import { sysLoginLogService } from './SysLoginLogService'
import z from 'zod'
import { SysLoginLogAddSchema, SysLoginLogUpdateSchema, SysLoginLogQuerySchema, SysLoginLogPageQuerySchema } from '#shared/system/loginLog'

const listProc = proc({ permission: 'system:loginLog:list' })
const addProc = proc({ permission: 'system:loginLog:add' })
const editProc = proc({ permission: 'system:loginLog:edit' })
const delProc = proc({ permission: 'system:loginLog:del' })

export const sysLoginLogRouter = router({
    create: addProc.input(SysLoginLogAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysLoginLogUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysLoginLogQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).getById(input)
        }),
    page: listProc.input(SysLoginLogPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).page(input)
        })
})
