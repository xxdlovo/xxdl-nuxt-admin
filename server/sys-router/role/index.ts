//#server/system-role-router
import { router, protectedProcedure } from '~~/server/trpc/init'
import { sysRoleService } from './SysRoleService'
import z from 'zod'
import { SysRoleAddSchema, SysRoleUpdateSchema, SysRoleQuerySchema, SysRolePageQuerySchema } from "#shared/system/role";

export const sysRoleRouter = router({
    create: protectedProcedure.input(SysRoleAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysRoleService(ctx).create(input)
        }),
    remove: protectedProcedure.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysRoleService(ctx).remove(input)
        }),
    batchDelete: protectedProcedure.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysRoleService(ctx).batchRemove(input)
        }),
    update: protectedProcedure.input(SysRoleUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysRoleService(ctx).updateById(input.id, input)
        }),
    getOne: protectedProcedure.input(SysRoleQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysRoleService(ctx).getOne(input)
        }),
    getById: protectedProcedure.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysRoleService(ctx).getById(input)
        }),
    page: protectedProcedure.input(SysRolePageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysRoleService(ctx).page(input)
        })
})
