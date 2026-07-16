//#server/sys-router/systemLog
import { router, crudPermissionProcedures } from '~~/server/trpc/init'
import { sysSystemLogService } from './SysSystemLogService'
import z from 'zod'
import { SysLogAddSchema, SysLogUpdateSchema, SysLogQuerySchema, SysLogPageQuerySchema } from "#shared/system/SysLog";

const p = crudPermissionProcedures('system:systemLog')

export const sysSystemLogRouter = router({
    create: p.add.input(SysLogAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).create(input)
        }),
    remove: p.del.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).remove(input)
        }),
    batchDelete: p.del.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).batchRemove(input)
        }),
    update: p.edit.input(SysLogUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).updateById(input.id, input)
        }),
    getOne: p.list.input(SysLogQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).getOne(input)
        }),
    getById: p.list.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).getById(input)
        }),
    page: p.list.input(SysLogPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).page(input)
        })
})
