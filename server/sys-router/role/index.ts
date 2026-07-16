//#server/system-role-router
import { router, crudPermissionProcedures } from '~~/server/trpc/init'
import { sysRoleService } from './SysRoleService'
import z from 'zod'
import { SysRoleAddSchema, SysRoleUpdateSchema, SysRoleQuerySchema, SysRolePageQuerySchema } from "#shared/system/role";

const p = crudPermissionProcedures('system:role')

export const sysRoleRouter = router({
    create: p.add.input(SysRoleAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysRoleService(ctx).create(input)
        }),
    remove: p.del.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysRoleService(ctx).remove(input)
        }),
    batchDelete: p.del.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysRoleService(ctx).batchRemove(input)
        }),
    update: p.edit.input(SysRoleUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysRoleService(ctx).updateById(input.id, input)
        }),
    getOne: p.list.input(SysRoleQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysRoleService(ctx).getOne(input)
        }),
    getById: p.list.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysRoleService(ctx).getById(input)
        }),
    page: p.list.input(SysRolePageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysRoleService(ctx).page(input)
        })
})
