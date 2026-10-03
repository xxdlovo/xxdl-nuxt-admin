//#server/trade-router/modules/goods
import { router, proc } from '~~/server/trpc/init'
import z from 'zod'
import {
    SysGoodsAddSchema,
    SysGoodsLevelPriceQuerySchema,
    SysGoodsLevelPricesSaveSchema,
    SysGoodsPageQuerySchema,
    SysGoodsQuerySchema,
    SysGoodsUpdateSchema
} from '#shared/system/goods'
import { sysGoodsService } from './SysGoodsService'

const listProc = proc({ permission: 'system:goods:list' })
const addProc = proc({ permission: 'system:goods:add' })
const editProc = proc({ permission: 'system:goods:edit' })
const delProc = proc({ permission: 'system:goods:del' })

export const sysGoodsRouter = router({
    create: addProc.input(SysGoodsAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysGoodsService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysGoodsService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysGoodsService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysGoodsUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysGoodsService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysGoodsQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysGoodsService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysGoodsService(ctx).getById(input)
        }),
    page: listProc.input(SysGoodsPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysGoodsService(ctx).page(input)
        }),

    /** 等级下拉（商品等级价弹窗用）：只列启用中的会员等级 */
    levelOptions: listProc
        .query(async ({ ctx }) => {
            return sysGoodsService(ctx).levelOptions()
        }),

    /** 某商品的等级价回显（含等级名） */
    levelPrices: listProc.input(SysGoodsLevelPriceQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysGoodsService(ctx).levelPrices(input)
        }),

    /** 保存等级价：整体替换，权限与商品编辑一致 */
    saveLevelPrices: editProc.input(SysGoodsLevelPricesSaveSchema)
        .mutation(async ({ ctx, input }) => {
            return sysGoodsService(ctx).saveLevelPrices(input)
        })
})
