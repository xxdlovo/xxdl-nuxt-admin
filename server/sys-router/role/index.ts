//#server/sys-router/role
import { router, proc } from '~~/server/trpc/init'
import { sysRoleService } from './SysRoleService'
import { sysRoleMenuService } from '#server/sys-router/roleMenu/SysRoleMenuService'
import { sysMenuService } from '#server/sys-router/menu/SysMenuService'
import z from 'zod'
import {
    SysRoleAddSchema,
    SysRoleUpdateSchema,
    SysRoleQuerySchema,
    SysRolePageQuerySchema,
    SysRoleDataScopeUpdateSchema
} from '#shared/system/role'
import { SysRoleMenuAssignedIdsQuerySchema, SysRoleMenuAssignSchema } from '#shared/system/roleMenu'

const addProc = proc({ permission: 'system:role:add' })
const editProc = proc({ permission: 'system:role:edit' })
const delProc = proc({ permission: 'system:role:del' })

// 角色列表类接口需要完整角色数据（用于选择器/授权），不做数据范围限制
const listProc = proc({ permission: 'system:role:list', dataScope: false })

export const sysRoleRouter = router({
    create: addProc.input(SysRoleAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysRoleService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysRoleService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysRoleService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysRoleUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysRoleService(ctx).updateById(input.id, input)
        }),
    updateDataScope: editProc.input(SysRoleDataScopeUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysRoleService(ctx).updateDataScope(input)
        }),
    getOne: listProc.input(SysRoleQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysRoleService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysRoleService(ctx).getById(input)
        }),
    list: listProc.input(SysRoleQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysRoleService(ctx).list(input)
        }),
    page: listProc.input(SysRolePageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysRoleService(ctx).page(input)
        }),
    assignableMenus: listProc.input(z.object({
        types: z.array(z.union([z.literal(0), z.literal(1), z.literal(2)])).min(1)
    }))
        .query(async ({ ctx, input }) => {
            return sysRoleService(ctx).listAssignableMenus(input.types)
        }),
    assignedMenuIds: listProc.input(SysRoleMenuAssignedIdsQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).listAssignedMenuIds(input)
        }),
    assignMenus: editProc.input(SysRoleMenuAssignSchema)
        .mutation(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).assignByRoleAndTypes(input)
        })
})
