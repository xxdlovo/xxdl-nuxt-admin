//#server/sys-router/menu
import { router, crudPermissionProcedures } from '~~/server/trpc/init'
import { sysMenuService } from './SysMenuService'
import z from 'zod'
import { SysMenuAddSchema, SysMenuUpdateSchema, SysMenuQuerySchema, SysMenuPageQuerySchema } from "#shared/system/menu";

const p = crudPermissionProcedures('system:menu')

export const sysMenuRouter = router({
    create: p.add.input(SysMenuAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMenuService(ctx).create(input)
        }),
    remove: p.del.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysMenuService(ctx).remove(input)
        }),
    batchDelete: p.del.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysMenuService(ctx).batchRemove(input)
        }),
    update: p.edit.input(SysMenuUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMenuService(ctx).updateById(input.id, input)
        }),
    getOne: p.list.input(SysMenuQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMenuService(ctx).getOne(input)
        }),
    getById: p.list.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysMenuService(ctx).getById(input)
        }),
    list: p.list.input(SysMenuQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMenuService(ctx).list(input)
        }),
    page: p.list.input(SysMenuPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMenuService(ctx).page(input)
        })
})
