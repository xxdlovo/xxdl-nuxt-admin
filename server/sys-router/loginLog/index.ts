//#server/system-loginLog-router
import { router, protectedProcedure } from '~~/server/trpc/init'
import { sysLoginLogService } from './SysLoginLogService'
import z from 'zod'
import { SysLoginLogAddSchema, SysLoginLogUpdateSchema, SysLoginLogQuerySchema, SysLoginLogPageQuerySchema } from "#shared/system/loginLog";

export const sysLoginLogRouter = router({
    create: protectedProcedure.input(SysLoginLogAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).create(input)
        }),
    remove: protectedProcedure.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).remove(input)
        }),
    batchDelete: protectedProcedure.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).batchRemove(input)
        }),
    update: protectedProcedure.input(SysLoginLogUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).updateById(input.id, input)
        }),
    getOne: protectedProcedure.input(SysLoginLogQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).getOne(input)
        }),
    getById: protectedProcedure.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).getById(input)
        }),
    page: protectedProcedure.input(SysLoginLogPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysLoginLogService(ctx).page(input)
        })
})
