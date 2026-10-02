//#server/trade-router/modules/payNotifyLog
import { router, proc } from '~~/server/trpc/init'
import { sysPayNotifyLogService } from './SysPayNotifyLogService'
import z from 'zod'
import {
    SysPayNotifyLogAddSchema,
    SysPayNotifyLogUpdateSchema,
    SysPayNotifyLogQuerySchema,
    SysPayNotifyLogPageQuerySchema
} from '#shared/system/payNotifyLog'

const listProc = proc({ permission: 'system:payNotifyLog:list' })
const addProc = proc({ permission: 'system:payNotifyLog:add' })
const editProc = proc({ permission: 'system:payNotifyLog:edit' })
const delProc = proc({ permission: 'system:payNotifyLog:del' })

export const sysPayNotifyLogRouter = router({
    create: addProc.input(SysPayNotifyLogAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysPayNotifyLogService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysPayNotifyLogService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysPayNotifyLogService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysPayNotifyLogUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysPayNotifyLogService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysPayNotifyLogQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysPayNotifyLogService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysPayNotifyLogService(ctx).getById(input)
        }),
    page: listProc.input(SysPayNotifyLogPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysPayNotifyLogService(ctx).page(input)
        })
})
