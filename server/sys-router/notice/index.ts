//#server/sys-router/notice
import { router, protectedProcedure, proc } from '~~/server/trpc/init'
import { sysNoticeService } from './SysNoticeService'
import z from 'zod'
import { SysNoticeAddSchema, SysNoticeUpdateSchema, SysNoticeQuerySchema, SysNoticePageQuerySchema, SysNoticePublishStatusSchema } from '#shared/system/notice'

const listProc = proc({ permission: 'system:notice:list' })
const addProc = proc({ permission: 'system:notice:add' })
const editProc = proc({ permission: 'system:notice:edit' })
const delProc = proc({ permission: 'system:notice:del' })

export const sysNoticeRouter = router({
    create: addProc.input(SysNoticeAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysNoticeService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysNoticeService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysNoticeService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysNoticeUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysNoticeService(ctx).updateById(input.id, input)
        }),
    updatePublishStatus: proc({ permission: 'system:notice:push' }).input(SysNoticePublishStatusSchema)
        .mutation(async ({ ctx, input }) => {
            return sysNoticeService(ctx).updatePublishStatus(input)
        }),
    getOne: listProc.input(SysNoticeQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysNoticeService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysNoticeService(ctx).getById(input)
        }),
    list: listProc.input(SysNoticeQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysNoticeService(ctx).list(input)
        }),
    page: listProc.input(SysNoticePageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysNoticeService(ctx).page(input)
        }),
    latest: protectedProcedure.input(z.object({
        limit: z.number().min(1).max(20).default(10)
    }).default({ limit: 10 }))
        .query(async ({ ctx, input }) => {
            return sysNoticeService(ctx).latest(input.limit)
        })
})
