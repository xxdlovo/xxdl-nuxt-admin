//#server/sys-router/dictType
import { router, crudPermissionProcedures } from '~~/server/trpc/init'
import { sysDictTypeService } from './SysDictTypeService'
import z from 'zod'
import { SysDictTypeAddSchema, SysDictTypeUpdateSchema, SysDictTypeQuerySchema, SysDictTypePageQuerySchema } from "#shared/system/dictType";

const p = crudPermissionProcedures('system:dictType')

export const sysDictTypeRouter = router({
    create: p.add.input(SysDictTypeAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).create(input)
        }),
    remove: p.del.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).remove(input)
        }),
    batchDelete: p.del.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).batchRemove(input)
        }),
    update: p.edit.input(SysDictTypeUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).updateById(input.id, input)
        }),
    getOne: p.list.input(SysDictTypeQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).getOne(input)
        }),
    getById: p.list.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).getById(input)
        }),
    page: p.list.input(SysDictTypePageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).page(input)
        })
})
