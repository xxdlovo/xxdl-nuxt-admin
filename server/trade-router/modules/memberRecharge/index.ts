//#server/trade-router/modules/memberRecharge
import { router, proc } from '~~/server/trpc/init'
import { sysMemberRechargeService } from './SysMemberRechargeService'
import z from 'zod'
import {
    SysMemberRechargeAddSchema,
    SysMemberRechargeUpdateSchema,
    SysMemberRechargeCloseSchema,
    SysMemberRechargeQuerySchema,
    SysMemberRechargePageQuerySchema
} from '#shared/system/memberRecharge'

const listProc = proc({ permission: 'system:memberRecharge:list' })
const addProc = proc({ permission: 'system:memberRecharge:add' })
const editProc = proc({ permission: 'system:memberRecharge:edit' })
const delProc = proc({ permission: 'system:memberRecharge:del' })
// 关闭会释放占用的优惠码，属于有副作用的写操作，单独授权
const closeProc = proc({ permission: 'system:memberRecharge:close' })

export const sysMemberRechargeRouter = router({
    // 手工补录充值单：只落库，不发起支付
    create: addProc.input(SysMemberRechargeAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberRechargeService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysMemberRechargeService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysMemberRechargeService(ctx).batchRemove(input)
        }),
    // 只允许改备注，已到账单据直接拒绝
    update: editProc.input(SysMemberRechargeUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberRechargeService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysMemberRechargeQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberRechargeService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysMemberRechargeService(ctx).getById(input)
        }),
    page: listProc.input(SysMemberRechargePageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberRechargeService(ctx).page(input)
        }),
    // 关闭待支付 / 异常充值单，并释放其占用的优惠码
    close: closeProc.input(SysMemberRechargeCloseSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberRechargeService(ctx).close(input)
        })
})
