//#admin/server/sys-router/dictData
import { router, proc, protectedProcedure, publicProcedure } from '#admin/server/trpc/init'
import { rateLimitMiddleware } from '#admin/server/trpc/middlewares/rateLimit'
import { sysDictDataService } from './SysDictDataService'
import z from 'zod'
import { SysDictDataAddSchema, SysDictDataUpdateSchema, SysDictDataQuerySchema, SysDictDataPageQuerySchema } from '#admin/shared/system/dictData'

const listProc = proc({ permission: 'system:dictData:list' })
const addProc = proc({ permission: 'system:dictData:add' })
const editProc = proc({ permission: 'system:dictData:edit' })
const delProc = proc({ permission: 'system:dictData:del' })

// 公开字典查询：匿名可访问，按 IP 限流（60 次/分钟）。
const publicLimit = rateLimitMiddleware({ limit: 60, windowMs: 60_000, scope: 'public-dict' })

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
        }),
    /**
     * 公开字典查询（无需登录）。
     * 只对 `publicDictTypeCodes` 白名单内的 typeCode 返回数据，且只含展示字段。
     * 新增公开字典时必须同步维护该白名单（见 hardening 文档）。
     */
    publicListByTypeCode: publicProcedure.use(publicLimit).input(z.string().min(1))
        .query(async ({ ctx, input }) => {
            return sysDictDataService(ctx).publicListByTypeCode(input)
        })
})
