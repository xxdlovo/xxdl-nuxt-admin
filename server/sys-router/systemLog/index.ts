//#server/sys-router/systemLog
import { router, protectedProcedure } from '~~/server/trpc/init'
import { sysSystemLogService } from './SysSystemLogService'
import z from 'zod'
import { SysLogAddSchema, SysLogUpdateSchema, SysLogQuerySchema, SysLogPageQuerySchema } from "#shared/system/SysLog";

export const sysSystemLogRouter = router({
    create: protectedProcedure.input(SysLogAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).create(input)
        }),
    remove: protectedProcedure.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).remove(input)
        }),
    batchDelete: protectedProcedure.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).batchRemove(input)
        }),
    update: protectedProcedure.input(SysLogUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).updateById(input.id, input)
        }),
    getOne: protectedProcedure.input(SysLogQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).getOne(input)
        }),
    getById: protectedProcedure.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).getById(input)
        }),
    page: protectedProcedure.input(SysLogPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysSystemLogService(ctx).page(input)
        })
})
