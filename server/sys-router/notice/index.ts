//#server/sys-router/notice
import { router, crudPermissionProcedures, protectedProcedure } from '~~/server/trpc/init'
import { sysNoticeService } from './SysNoticeService'
import z from 'zod'
import { SysNoticeAddSchema, SysNoticeUpdateSchema, SysNoticeQuerySchema, SysNoticePageQuerySchema, SysNoticePublishStatusSchema } from '#shared/system/notice'

const p = crudPermissionProcedures('system:notice')

export const sysNoticeRouter = router({
    create: p.add.input(SysNoticeAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysNoticeService(ctx).create(input)
        }),
    remove: p.del.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysNoticeService(ctx).remove(input)
        }),
    batchDelete: p.del.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysNoticeService(ctx).batchRemove(input)
        }),
    update: p.edit.input(SysNoticeUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysNoticeService(ctx).updateById(input.id, input)
        }),
    updatePublishStatus: p.edit.input(SysNoticePublishStatusSchema)
        .mutation(async ({ ctx, input }) => {
            return sysNoticeService(ctx).updatePublishStatus(input)
        }),
    getOne: p.list.input(SysNoticeQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysNoticeService(ctx).getOne(input)
        }),
    getById: p.list.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysNoticeService(ctx).getById(input)
        }),
    list: p.list.input(SysNoticeQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysNoticeService(ctx).list(input)
        }),
    page: p.list.input(SysNoticePageQuerySchema)
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
