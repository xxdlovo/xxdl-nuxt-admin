//#server/sys-router/menu
import { router, proc } from '~~/server/trpc/init'
import { sysMenuService } from './SysMenuService'
import z from 'zod'
import { SysMenuAddSchema, SysMenuUpdateSchema, SysMenuQuerySchema, SysMenuPageQuerySchema } from '#shared/system/menu'

const listProc = proc({ permission: 'system:menu:list' })
const addProc = proc({ permission: 'system:menu:add' })
const editProc = proc({ permission: 'system:menu:edit' })
const delProc = proc({ permission: 'system:menu:del' })

export const sysMenuRouter = router({
    create: addProc.input(SysMenuAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMenuService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysMenuService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysMenuService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysMenuUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMenuService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysMenuQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMenuService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysMenuService(ctx).getById(input)
        }),
    list: listProc.input(SysMenuQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMenuService(ctx).list(input)
        }),
    page: listProc.input(SysMenuPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMenuService(ctx).page(input)
        })
})
