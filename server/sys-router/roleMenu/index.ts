//#server/sys-router/roleMenu
import { router, crudPermissionProcedures } from '~~/server/trpc/init'
import { sysRoleMenuService } from './SysRoleMenuService'
import z from 'zod'
import { SysRoleMenuAddSchema, SysRoleMenuUpdateSchema, SysRoleMenuQuerySchema, SysRoleMenuPageQuerySchema } from "#shared/system/roleMenu";

const p = crudPermissionProcedures('system:roleMenu')

export const sysRoleMenuRouter = router({
    create: p.add.input(SysRoleMenuAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).create(input)
        }),
    remove: p.del.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).remove(input)
        }),
    batchDelete: p.del.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).batchRemove(input)
        }),
    update: p.edit.input(SysRoleMenuUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).updateById(input.id, input)
        }),
    getOne: p.list.input(SysRoleMenuQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).getOne(input)
        }),
    getById: p.list.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).getById(input)
        }),
    page: p.list.input(SysRoleMenuPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).page(input)
        })
})
