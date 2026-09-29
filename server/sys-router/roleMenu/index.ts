//#server/sys-router/roleMenu
import { router, proc } from '~~/server/trpc/init'
import { sysRoleMenuService } from './SysRoleMenuService'
import z from 'zod'
import { SysRoleMenuAddSchema, SysRoleMenuUpdateSchema, SysRoleMenuQuerySchema, SysRoleMenuPageQuerySchema } from '#shared/system/roleMenu'

const listProc = proc({ permission: 'system:roleMenu:list' })
const addProc = proc({ permission: 'system:roleMenu:add' })
const editProc = proc({ permission: 'system:roleMenu:edit' })
const delProc = proc({ permission: 'system:roleMenu:del' })

export const sysRoleMenuRouter = router({
    create: addProc.input(SysRoleMenuAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysRoleMenuUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysRoleMenuQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).getById(input)
        }),
    page: listProc.input(SysRoleMenuPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysRoleMenuService(ctx).page(input)
        })
})
