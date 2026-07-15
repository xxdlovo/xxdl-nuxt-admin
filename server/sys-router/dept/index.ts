//#server/sys-router/department
import { router, protectedProcedure } from '~~/server/trpc/init'
import { sysDeptService } from './SysDeptService'
import z from 'zod'
import { SysDeptAddSchema, SysDeptUpdateSchema, SysDeptQuerySchema, SysDeptPageQuerySchema } from "#shared/system/department";

export const sysDeptRouter = router({
    create: protectedProcedure.input(SysDeptAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysDeptService(ctx).create(input)
        }),
    remove: protectedProcedure.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysDeptService(ctx).remove(input)
        }),
    batchDelete: protectedProcedure.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysDeptService(ctx).batchRemove(input)
        }),
    update: protectedProcedure.input(SysDeptUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysDeptService(ctx).updateById(input.id, input)
        }),
    getOne: protectedProcedure.input(SysDeptQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysDeptService(ctx).getOne(input)
        }),
    getById: protectedProcedure.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysDeptService(ctx).getById(input)
        }),
    page: protectedProcedure.input(SysDeptPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysDeptService(ctx).page(input)
        })
})
