//#server/sys-router/dictType
import { router, protectedProcedure } from '~~/server/trpc/init'
import { sysDictTypeService } from './SysDictTypeService'
import z from 'zod'
import { SysDictTypeAddSchema, SysDictTypeUpdateSchema, SysDictTypeQuerySchema, SysDictTypePageQuerySchema } from "#shared/system/dictType";

export const sysDictTypeRouter = router({
    create: protectedProcedure.input(SysDictTypeAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).create(input)
        }),
    remove: protectedProcedure.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).remove(input)
        }),
    batchDelete: protectedProcedure.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).batchRemove(input)
        }),
    update: protectedProcedure.input(SysDictTypeUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).updateById(input.id, input)
        }),
    getOne: protectedProcedure.input(SysDictTypeQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).getOne(input)
        }),
    getById: protectedProcedure.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).getById(input)
        }),
    page: protectedProcedure.input(SysDictTypePageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).page(input)
        })
})
