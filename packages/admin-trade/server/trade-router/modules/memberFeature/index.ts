//#trade/server/trade-router/modules/memberFeature
import { router, proc } from '#admin/server/trpc/init'
import z from 'zod'
import { sysMemberFeatureService } from './SysMemberFeatureService'
import {
    SysMemberFeatureAddSchema,
    SysMemberFeaturePageQuerySchema,
    SysMemberFeatureUpdateSchema
} from '#trade/shared/system/memberFeature'

/**
 * 功能目录是**全局字典**（没有 user_id / dept_id 维度），读写都不参与数据范围过滤：
 * 若沿用默认数据范围，只读角色可能拿到被 `createdBy` 收窄的空目录，
 * 进而让 entitlement 数据源与后台看到的功能集合不一致。
 */
const listProc = proc({ permission: 'system:memberFeature:list', dataScope: false })
const addProc = proc({ permission: 'system:memberFeature:add', dataScope: false })
const editProc = proc({ permission: 'system:memberFeature:edit', dataScope: false })
const delProc = proc({ permission: 'system:memberFeature:del', dataScope: false })

export const sysMemberFeatureRouter = router({
    create: addProc.input(SysMemberFeatureAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberFeatureService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysMemberFeatureService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysMemberFeatureService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysMemberFeatureUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberFeatureService(ctx).updateById(input.id, input)
        }),
    page: listProc.input(SysMemberFeaturePageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberFeatureService(ctx).page(input)
        }),

    /** 已注册的已使用量计量键（配额功能的 resolverKey 下拉；权限沿用 :list） */
    resolvers: listProc
        .query(async ({ ctx }) => {
            return sysMemberFeatureService(ctx).resolvers()
        })
})
