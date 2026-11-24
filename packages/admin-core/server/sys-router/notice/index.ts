//#admin/server/sys-router/notice
import { router, protectedProcedure, proc, publicProcedure } from '#admin/server/trpc/init'
import { sysNoticeService } from './SysNoticeService'
import z from 'zod'
import { SysNoticeAddSchema, SysNoticeUpdateSchema, SysNoticeQuerySchema, SysNoticePageQuerySchema, SysNoticePublicPageQuerySchema, SysNoticePublishStatusSchema } from '#admin/shared/system/notice'

const listProc = proc({ permission: 'system:notice:list' })
const addProc = proc({ permission: 'system:notice:add', repeatSubmit: true })
const editProc = proc({ permission: 'system:notice:edit', repeatSubmit: true })
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
    /**
     * 公开公告分页：无需登录，只返回已发布且发布时间已到的公告，按 publishTime 倒序。
     * 适合官网/落地页/小程序等未登录场景展示公告列表。
     */
    publicPage: publicProcedure.input(SysNoticePublicPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysNoticeService(ctx).publicPage(input)
        }),
    /** 管理端按 publishTime 倒序分页（含未发布），沿用公告列表权限。 */
    pageByPublishTime: listProc.input(SysNoticePageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysNoticeService(ctx).pageByPublishTime(input)
        }),
    latest: protectedProcedure.input(z.object({
        limit: z.number().min(1).max(20).default(10)
    }).default({ limit: 10 }))
        .query(async ({ ctx, input }) => {
            return sysNoticeService(ctx).latest(input.limit)
        })
})
