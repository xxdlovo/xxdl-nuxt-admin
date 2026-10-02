//#server/trade-router/modules/memberCoupon
import { router, proc } from '~~/server/trpc/init'
import { sysMemberCouponService } from './SysMemberCouponService'
import z from 'zod'
import {
    SysMemberCouponAddSchema,
    SysMemberCouponUpdateSchema,
    SysMemberCouponQuerySchema,
    SysMemberCouponPageQuerySchema,
    SysMemberCouponVoidSchema
} from '#shared/system/memberCoupon'

const listProc = proc({ permission: 'system:memberCoupon:list' })
const addProc = proc({ permission: 'system:memberCoupon:add' })
const editProc = proc({ permission: 'system:memberCoupon:edit' })
const delProc = proc({ permission: 'system:memberCoupon:del' })
// 作废是「发出去就收不回」的高敏感动作，单独授权便于只读/客服角色排除
const voidProc = proc({ permission: 'system:memberCoupon:void' })

export const sysMemberCouponRouter = router({
    create: addProc.input(SysMemberCouponAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberCouponService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysMemberCouponService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysMemberCouponService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysMemberCouponUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberCouponService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysMemberCouponQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberCouponService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysMemberCouponService(ctx).getById(input)
        }),
    page: listProc.input(SysMemberCouponPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberCouponService(ctx).page(input)
        }),
    // 作废：status 置 2，只能用一次；重复调用幂等返回 true
    void: voidProc.input(SysMemberCouponVoidSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberCouponService(ctx).voidCoupon(input)
        })
})
