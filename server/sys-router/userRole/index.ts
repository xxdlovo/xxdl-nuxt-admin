//#server/system-userRole-router
import { router, crudPermissionProcedures } from '~~/server/trpc/init'
import { sysUserRoleService } from './SysUserRoleService'
import z from 'zod'
import { SysUserRoleAddSchema, SysUserRoleUpdateSchema, SysUserRoleQuerySchema, SysUserRolePageQuerySchema } from "#shared/system/userRole";

const p = crudPermissionProcedures('system:userRole')

export const sysUserRoleRouter = router({
    create: p.add.input(SysUserRoleAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).create(input)
        }),
    remove: p.del.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).remove(input)
        }),
    batchDelete: p.del.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).batchRemove(input)
        }),
    update: p.edit.input(SysUserRoleUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).updateById(input.id, input)
        }),
    getOne: p.list.input(SysUserRoleQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).getOne(input)
        }),
    getById: p.list.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).getById(input)
        }),
    page: p.list.input(SysUserRolePageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysUserRoleService(ctx).page(input)
        })
})
