//#server/sys-router/dictData
import { router, protectedProcedure } from '~~/server/trpc/init'
import { sysDictDataService } from './SysDictDataService'
import z from 'zod'
import { SysDictDataAddSchema, SysDictDataUpdateSchema, SysDictDataQuerySchema, SysDictDataPageQuerySchema } from "#shared/system/dictData";

export const sysDictDataRouter = router({
    create: protectedProcedure.input(SysDictDataAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysDictDataService(ctx).create(input)
        }),
    remove: protectedProcedure.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysDictDataService(ctx).remove(input)
        }),
    batchDelete: protectedProcedure.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysDictDataService(ctx).batchRemove(input)
        }),
    update: protectedProcedure.input(SysDictDataUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysDictDataService(ctx).updateById(input.id, input)
        }),
    getOne: protectedProcedure.input(SysDictDataQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysDictDataService(ctx).getOne(input)
        }),
    getById: protectedProcedure.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysDictDataService(ctx).getById(input)
        }),
    page: protectedProcedure.input(SysDictDataPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysDictDataService(ctx).page(input)
        })
})
