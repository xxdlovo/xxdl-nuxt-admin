//#server/trade-router/modules/order
import { router, proc, protectedProcedure } from '~~/server/trpc/init'
import z from 'zod'
import {
    SysOrderCloseSchema,
    SysOrderConfirmSchema,
    SysOrderCreateSchema,
    SysOrderFulfillSchema,
    SysOrderMyQuerySchema,
    SysOrderNoSchema,
    SysOrderPageQuerySchema,
    SysOrderQuerySchema,
    SysOrderSummarySchema,
    SysOrderSyncSchema,
    SysOrderUpdateSchema
} from '#shared/system/order'
import { SysMallQuerySchema } from '#shared/system/goods'
import { SysMemberUserOptionQuerySchema } from '#shared/system/member'
import { sysOrderService } from './SysOrderService'

const listProc = proc({ permission: 'system:order:list' })
const editProc = proc({ permission: 'system:order:edit' })
const delProc = proc({ permission: 'system:order:del' })
// 以下动作都会推进订单状态并牵动资金/库存/优惠码，各自单独授权
const confirmProc = proc({ permission: 'system:order:confirm' })
const closeProc = proc({ permission: 'system:order:close' })
const syncProc = proc({ permission: 'system:order:sync' })
const fulfillProc = proc({ permission: 'system:order:fulfill' })

export const sysOrderRouter = router({
    getOne: listProc.input(SysOrderQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysOrderService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysOrderService(ctx).getById(input)
        }),
    page: listProc.input(SysOrderPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysOrderService(ctx).page(input)
        }),

    /** 订单只允许改备注，金额与状态由业务动作驱动 */
    update: editProc.input(SysOrderUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOrderService(ctx).update(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysOrderService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysOrderService(ctx).batchRemove(input)
        }),

    /** 确认支付：余额单实扣（确认冻结 + 核销券 + 加销量） */
    confirm: confirmProc.input(SysOrderConfirmSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOrderService(ctx).confirm(input)
        }),

    /** 关闭订单：释放冻结 / 优惠码 / 回滚库存 */
    close: closeProc.input(SysOrderCloseSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOrderService(ctx).close(input)
        }),

    /** 同步支付状态：向渠道查询并按幂等路径推进订单 */
    sync: syncProc.input(SysOrderSyncSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOrderService(ctx).sync(input)
        }),

    /** 服务交付：已支付且待交付的服务类订单 */
    fulfill: fulfillProc.input(SysOrderFulfillSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOrderService(ctx).fulfill(input)
        }),

    /** 看板统计：区间成交 + 待支付 / 待交付 / 今日 */
    summary: listProc.input(SysOrderSummarySchema)
        .query(async ({ ctx, input }) => {
            return sysOrderService(ctx).summary(input)
        }),

    /** 会员下拉搜索（订单按会员筛选） */
    userOptions: listProc.input(SysMemberUserOptionQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysOrderService(ctx).userOptions(input)
        }),

    // ── 会员自助（登录即可，不需要管理权限；服务端强制只操作自己的单） ──────

    /** 我的订单列表 */
    myPage: protectedProcedure.input(SysOrderMyQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysOrderService(ctx).myPage(input)
        }),

    /** 我的订单详情（校验归属） */
    myDetail: protectedProcedure.input(SysOrderNoSchema)
        .query(async ({ ctx, input }) => {
            return sysOrderService(ctx).myDetail(input)
        }),

    /** 自助下单：userId 取会话，requestId 为幂等键 */
    myCreate: protectedProcedure.input(SysOrderCreateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOrderService(ctx).myCreate(input)
        }),

    /** 我的订单确认支付（余额单实扣） */
    myConfirm: protectedProcedure.input(SysOrderNoSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOrderService(ctx).myConfirm(input)
        }),

    /** 我的订单取消（释放冻结 / 优惠码 / 库存） */
    myCancel: protectedProcedure.input(SysOrderNoSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOrderService(ctx).myCancel(input)
        }),

    /** 我的在线订单主动同步状态 */
    mySync: protectedProcedure.input(SysOrderNoSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOrderService(ctx).mySync(input)
        }),

    /** 我的订单支付码（本地读支付单，可重复调用，供页面刷新后重新展示二维码） */
    myPayment: protectedProcedure.input(SysOrderNoSchema)
        .query(async ({ ctx, input }) => {
            return sysOrderService(ctx).myPayment(input)
        }),

    /** 商城列表：只列上架商品，价格按当前会员等级解析 */
    mallList: protectedProcedure.input(SysMallQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysOrderService(ctx).mallList(input)
        }),

    /** 商城商品详情：未上架 / 不存在分别报错 */
    mallDetail: protectedProcedure.input(z.object({ goodsId: z.string().min(1, 'form.required') }))
        .query(async ({ ctx, input }) => {
            return sysOrderService(ctx).mallDetail(input)
        })
})
