//#server/system-loginLog-router
import { router, crudPermissionProcedures } from '~~/server/trpc/init'
import { sysLoginLogService } from './SysLoginLogService'
import z from 'zod'
import { SysLoginLogAddSchema, SysLoginLogUpdateSchema, SysLoginLogQuerySchema, SysLoginLogPageQuerySchema } from "#shared/system/loginLog";

const p = crudPermissionProcedures('system:loginLog')

export const sysLoginLogRouter = router({
    create: p.add.input(SysLoginLogAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).create(input)
        }),
    remove: p.del.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).remove(input)
        }),
    batchDelete: p.del.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).batchRemove(input)
        }),
    update: p.edit.input(SysLoginLogUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).updateById(input.id, input)
        }),
    getOne: p.list.input(SysLoginLogQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).getOne(input)
        }),
    getById: p.list.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).getById(input)
        }),
    page: p.list.input(SysLoginLogPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).page(input)
        })
})
