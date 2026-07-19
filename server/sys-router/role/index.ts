//#server/system-role-router
import { router, crudPermissionProcedures } from '~~/server/trpc/init'
import { sysRoleService } from './SysRoleService'
import { sysRoleMenuService } from '#server/sys-router/roleMenu/SysRoleMenuService'
import { sysMenuService } from '#server/sys-router/menu/SysMenuService'
import z from 'zod'
import { SysRoleAddSchema, SysRoleUpdateSchema, SysRoleQuerySchema, SysRolePageQuerySchema } from "#shared/system/role";
import { SysRoleMenuAssignedIdsQuerySchema, SysRoleMenuAssignSchema } from '#shared/system/roleMenu'

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
    list: p.list.input(SysRoleQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysRoleService(ctx).list(input)
        }),
    page: p.list.input(SysRolePageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysRoleService(ctx).page(input)
        }),
    assignableMenus: p.list.input(z.object({
        types: z.array(z.union([z.literal(0), z.literal(1), z.literal(2)])).min(1)
    }))
        .query(async ({ ctx, input }) => {
            const menus = await sysMenuService(ctx).list({})
            return menus.filter(menu => menu.type != null && input.types.includes(menu.type as 0 | 1 | 2))
        }),
    assignedMenuIds: p.list.input(SysRoleMenuAssignedIdsQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).listAssignedMenuIds(input)
        }),
    assignMenus: p.edit.input(SysRoleMenuAssignSchema)
        .mutation(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).assignByRoleAndTypes(input)
        })
})
