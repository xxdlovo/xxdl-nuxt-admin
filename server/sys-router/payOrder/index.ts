//#server/sys-router/payOrder
import { router, proc } from '~~/server/trpc/init'
import { sysPayOrderService } from './SysPayOrderService'
import z from 'zod'
import {
    SysPayOrderAddSchema,
    SysPayOrderUpdateSchema,
    SysPayOrderQuerySchema,
    SysPayOrderPageQuerySchema
} from '#shared/system/payOrder'

const listProc = proc({ permission: 'system:payOrder:list' })
const addProc = proc({ permission: 'system:payOrder:add' })
const editProc = proc({ permission: 'system:payOrder:edit' })
const delProc = proc({ permission: 'system:payOrder:del' })
// 主动查询会推进本地订单状态，属于有副作用的写操作，单独授权
const queryProc = proc({ permission: 'system:payOrder:query' })

export const sysPayOrderRouter = router({
    create: addProc.input(SysPayOrderAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysPayOrderService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysPayOrderService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysPayOrderService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysPayOrderUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysPayOrderService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysPayOrderQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysPayOrderService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysPayOrderService(ctx).getById(input)
        }),
    page: listProc.input(SysPayOrderPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysPayOrderService(ctx).page(input)
        }),
    // 同步状态：调用渠道查询接口并推进本地状态
    syncStatus: queryProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysPayOrderService(ctx).syncStatus(input)
        }),
    // 关闭未支付订单（仅改本地状态，虎皮椒等平台没有取消接口）
    close: editProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysPayOrderService(ctx).close(input)
        }),
    // 某笔订单的回调 / 查询日志时间线
    notifyLogs: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysPayOrderService(ctx).notifyLogs(input)
        })
})
