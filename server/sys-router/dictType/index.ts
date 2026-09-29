//#server/sys-router/dictType
import { router, proc } from '~~/server/trpc/init'
import { sysDictTypeService } from './SysDictTypeService'
import z from 'zod'
import { SysDictTypeAddSchema, SysDictTypeUpdateSchema, SysDictTypeQuerySchema, SysDictTypePageQuerySchema } from '#shared/system/dictType'

const listProc = proc({ permission: 'system:dictType:list' })
const addProc = proc({ permission: 'system:dictType:add' })
const editProc = proc({ permission: 'system:dictType:edit' })
const delProc = proc({ permission: 'system:dictType:del' })

export const sysDictTypeRouter = router({
    create: addProc.input(SysDictTypeAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysDictTypeUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysDictTypeQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).getById(input)
        }),
    page: listProc.input(SysDictTypePageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysDictTypeService(ctx).page(input)
        })
})
