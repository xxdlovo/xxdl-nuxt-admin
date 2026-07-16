//#server/sys-router/roleMenu
import { router, protectedProcedure } from '~~/server/trpc/init'
import { sysRoleMenuService } from './SysRoleMenuService'
import z from 'zod'
import { SysRoleMenuAddSchema, SysRoleMenuUpdateSchema, SysRoleMenuQuerySchema, SysRoleMenuPageQuerySchema } from "#shared/system/roleMenu";

export const sysRoleMenuRouter = router({
    create: protectedProcedure.input(SysRoleMenuAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).create(input)
        }),
    remove: protectedProcedure.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).remove(input)
        }),
    batchDelete: protectedProcedure.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).batchRemove(input)
        }),
    update: protectedProcedure.input(SysRoleMenuUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).updateById(input.id, input)
        }),
    getOne: protectedProcedure.input(SysRoleMenuQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).getOne(input)
        }),
    getById: protectedProcedure.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).getById(input)
        }),
    page: protectedProcedure.input(SysRoleMenuPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).page(input)
        })
})
