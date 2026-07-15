//#server/sys-router/menu
import { router, protectedProcedure } from '~~/server/trpc/init'
import { sysMenuService } from './SysMenuService'
import z from 'zod'
import { SysMenuAddSchema, SysMenuUpdateSchema, SysMenuQuerySchema, SysMenuPageQuerySchema } from "#shared/system/menu";

export const sysMenuRouter = router({
    create: protectedProcedure.input(SysMenuAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMenuService(ctx).create(input)
        }),
    remove: protectedProcedure.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysMenuService(ctx).remove(input)
        }),
    batchDelete: protectedProcedure.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysMenuService(ctx).batchRemove(input)
        }),
    update: protectedProcedure.input(SysMenuUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMenuService(ctx).updateById(input.id, input)
        }),
    getOne: protectedProcedure.input(SysMenuQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMenuService(ctx).getOne(input)
        }),
    getById: protectedProcedure.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysMenuService(ctx).getById(input)
        }),
    page: protectedProcedure.input(SysMenuPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMenuService(ctx).page(input)
        })
})
