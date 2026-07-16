//#server/system-userRole-router
import { router, protectedProcedure } from '~~/server/trpc/init'
import { sysUserRoleService } from './SysUserRoleService'
import z from 'zod'
import { SysUserRoleAddSchema, SysUserRoleUpdateSchema, SysUserRoleQuerySchema, SysUserRolePageQuerySchema } from "#shared/system/userRole";

export const sysUserRoleRouter = router({
    create: protectedProcedure.input(SysUserRoleAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).create(input)
        }),
    remove: protectedProcedure.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).remove(input)
        }),
    batchDelete: protectedProcedure.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).batchRemove(input)
        }),
    update: protectedProcedure.input(SysUserRoleUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).updateById(input.id, input)
        }),
    getOne: protectedProcedure.input(SysUserRoleQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).getOne(input)
        }),
    getById: protectedProcedure.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).getById(input)
        }),
    page: protectedProcedure.input(SysUserRolePageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).page(input)
        })
})
