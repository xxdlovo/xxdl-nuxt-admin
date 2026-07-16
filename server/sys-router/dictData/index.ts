//#server/sys-router/dictData
import { router, crudPermissionProcedures } from '~~/server/trpc/init'
import { sysDictDataService } from './SysDictDataService'
import z from 'zod'
import { SysDictDataAddSchema, SysDictDataUpdateSchema, SysDictDataQuerySchema, SysDictDataPageQuerySchema } from "#shared/system/dictData";

const p = crudPermissionProcedures('system:dictData')

export const sysDictDataRouter = router({
    create: p.add.input(SysDictDataAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysDictDataService(ctx).create(input)
        }),
    remove: p.del.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysDictDataService(ctx).remove(input)
        }),
    batchDelete: p.del.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysDictDataService(ctx).batchRemove(input)
        }),
    update: p.edit.input(SysDictDataUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysDictDataService(ctx).updateById(input.id, input)
        }),
    getOne: p.list.input(SysDictDataQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysDictDataService(ctx).getOne(input)
        }),
    getById: p.list.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysDictDataService(ctx).getById(input)
        }),
    page: p.list.input(SysDictDataPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysDictDataService(ctx).page(input)
        })
})
