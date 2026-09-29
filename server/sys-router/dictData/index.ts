//#server/sys-router/dictData
import { router, proc, protectedProcedure } from '~~/server/trpc/init'
import { sysDictDataService } from './SysDictDataService'
import z from 'zod'
import { SysDictDataAddSchema, SysDictDataUpdateSchema, SysDictDataQuerySchema, SysDictDataPageQuerySchema } from '#shared/system/dictData'

const listProc = proc({ permission: 'system:dictData:list' })
const addProc = proc({ permission: 'system:dictData:add' })
const editProc = proc({ permission: 'system:dictData:edit' })
const delProc = proc({ permission: 'system:dictData:del' })

export const sysDictDataRouter = router({
    create: addProc.input(SysDictDataAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysDictDataService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysDictDataService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysDictDataService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysDictDataUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysDictDataService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysDictDataQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysDictDataService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysDictDataService(ctx).getById(input)
        }),
    page: listProc.input(SysDictDataPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysDictDataService(ctx).page(input)
        }),
    listByTypeCode: protectedProcedure.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysDictDataService(ctx).listByTypeCode(input)
        })
})
