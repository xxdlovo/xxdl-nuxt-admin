//#trade/server/trade-router/modules/memberLevel
import { router, proc } from '#admin/server/trpc/init'
import { sysMemberLevelService } from './SysMemberLevelService'
import z from 'zod'
import {
    SysMemberLevelAddSchema,
    SysMemberLevelUpdateSchema,
    SysMemberLevelQuerySchema,
    SysMemberLevelPageQuerySchema
} from '#trade/shared/system/memberLevel'
import { SysMemberLevelSaveFeaturesSchema } from '#trade/shared/system/memberFeature'

const listProc = proc({ permission: 'system:memberLevel:list' })
const addProc = proc({ permission: 'system:memberLevel:add' })
const editProc = proc({ permission: 'system:memberLevel:edit' })
const delProc = proc({ permission: 'system:memberLevel:del' })
// 能力矩阵保存单独授权：能改等级不等于能改「等级能给什么能力/多少额度」
const featureProc = proc({ permission: 'system:memberLevel:feature' })
// 等级是全局字典数据，不参与数据权限过滤：下拉与等级展示需要完整的启用等级
const listAllProc = proc({ permission: 'system:memberLevel:list', dataScope: false })

export const sysMemberLevelRouter = router({
    create: addProc.input(SysMemberLevelAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberLevelService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysMemberLevelService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysMemberLevelService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysMemberLevelUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberLevelService(ctx).updateById(input.id, input)
        }),

    /**
     * 等级能力矩阵（全部启用功能 × 该等级取值 + 元数据）。
     * 只读，权限沿用 system:memberLevel:list。
     */
    featureMatrix: listProc.input(SysMemberLevelSaveFeaturesSchema.pick({ levelId: true }))
        .query(async ({ ctx, input }) => {
            return sysMemberLevelService(ctx).featureMatrix(input.levelId)
        }),

    /**
     * 保存等级能力矩阵（整体覆盖）。
     * 独立权限码 system:memberLevel:feature，菜单行挂在会员等级页 ...1001 下。
     */
    saveFeatures: featureProc.input(SysMemberLevelSaveFeaturesSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberLevelService(ctx).saveFeatures(input)
        }),
    getOne: listProc.input(SysMemberLevelQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberLevelService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysMemberLevelService(ctx).getById(input)
        }),
    page: listProc.input(SysMemberLevelPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberLevelService(ctx).page(input)
        }),
    // 启用中的等级列表（下拉用）：等级是全局字典数据，不做数据范围过滤
    list: listAllProc.input(SysMemberLevelQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberLevelService(ctx).list(input)
        })
})
