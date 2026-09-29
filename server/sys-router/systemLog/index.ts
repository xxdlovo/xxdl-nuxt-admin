//#server/sys-router/systemLog
import { router, proc } from '~~/server/trpc/init'
import { sysSystemLogService } from './SysSystemLogService'
import z from 'zod'
import { SysLogAddSchema, SysLogUpdateSchema, SysLogQuerySchema, SysLogPageQuerySchema } from '#shared/system/SysLog'

const listProc = proc({ permission: 'system:systemLog:list' })
const addProc = proc({ permission: 'system:systemLog:add' })
const editProc = proc({ permission: 'system:systemLog:edit' })
const delProc = proc({ permission: 'system:systemLog:del' })

export const sysSystemLogRouter = router({
    create: addProc.input(SysLogAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysLogUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysLogQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).getById(input)
        }),
    page: listProc.input(SysLogPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).page(input)
        })
})
