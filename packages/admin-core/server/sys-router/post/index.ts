import { router, proc } from '#admin/server/trpc/init'
import z from 'zod'
import {
    SysPostAddSchema,
    SysPostPageQuerySchema,
    SysPostQuerySchema,
    SysPostUpdateSchema,
} from '#admin/shared/system/post'
import { sysPostService } from './SysPostService'

const listProc = proc({ permission: 'system:post:list', dataScope: false })
const addProc = proc({ permission: 'system:post:add', dataScope: false, repeatSubmit: true })
const editProc = proc({ permission: 'system:post:edit', dataScope: false, repeatSubmit: true })
const delProc = proc({ permission: 'system:post:del', dataScope: false })

export const sysPostRouter = router({
    create: addProc.input(SysPostAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysPostService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysPostService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysPostService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysPostUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysPostService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysPostQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysPostService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysPostService(ctx).getById(input)
        }),
    page: listProc.input(SysPostPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysPostService(ctx).page(input)
        }),
    list: listProc.input(SysPostQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysPostService(ctx).list(input)
        }),
    listEnabled: listProc
        .query(async ({ ctx }) => {
            return sysPostService(ctx).listEnabled()
        }),
})
