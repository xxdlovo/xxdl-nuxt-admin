import { z } from 'zod'
import { SysOrderBaseSchema } from './common'

/**
 * 订单响应：订单字段 + 联表带出的会员信息（后台列表与详情共用）。
 * 会员信息为 nullish：会员档案可能还没有（例如用户档案缺失时）。
 */
export const SysOrderRespSchema = z.object({
    id: SysOrderBaseSchema.shape.id,
    orderNo: SysOrderBaseSchema.shape.orderNo,
    requestId: SysOrderBaseSchema.shape.requestId,
    userId: SysOrderBaseSchema.shape.userId,
    nickname: z.string().nullish(),
    username: z.string().nullish(),
    phone: z.string().nullish(),
    levelName: z.string().nullish(),
    goodsId: SysOrderBaseSchema.shape.goodsId,
    goodsName: SysOrderBaseSchema.shape.goodsName,
    goodsCover: SysOrderBaseSchema.shape.goodsCover,
    goodsType: SysOrderBaseSchema.shape.goodsType,
    unitPrice: SysOrderBaseSchema.shape.unitPrice,
    priceSource: SysOrderBaseSchema.shape.priceSource,
    levelId: SysOrderBaseSchema.shape.levelId,
    quantity: SysOrderBaseSchema.shape.quantity,
    totalAmount: SysOrderBaseSchema.shape.totalAmount,
    discountAmount: SysOrderBaseSchema.shape.discountAmount,
    payAmount: SysOrderBaseSchema.shape.payAmount,
    giftAmount: SysOrderBaseSchema.shape.giftAmount,
    rechargeAmount: SysOrderBaseSchema.shape.rechargeAmount,
    payMode: SysOrderBaseSchema.shape.payMode,
    status: SysOrderBaseSchema.shape.status,
    couponId: SysOrderBaseSchema.shape.couponId,
    couponCode: SysOrderBaseSchema.shape.couponCode,
    freezeId: SysOrderBaseSchema.shape.freezeId,
    payOrderId: SysOrderBaseSchema.shape.payOrderId,
    payChannelCode: SysOrderBaseSchema.shape.payChannelCode,
    contact: SysOrderBaseSchema.shape.contact,
    fulfillStatus: SysOrderBaseSchema.shape.fulfillStatus,
    fulfilledAt: SysOrderBaseSchema.shape.fulfilledAt,
    fulfillRemark: SysOrderBaseSchema.shape.fulfillRemark,
    fulfillOperatorId: SysOrderBaseSchema.shape.fulfillOperatorId,
    expireAt: SysOrderBaseSchema.shape.expireAt,
    paidAt: SysOrderBaseSchema.shape.paidAt,
    finishedAt: SysOrderBaseSchema.shape.finishedAt,
    closedAt: SysOrderBaseSchema.shape.closedAt,
    closeReason: SysOrderBaseSchema.shape.closeReason,
    failReason: SysOrderBaseSchema.shape.failReason,
    remark: SysOrderBaseSchema.shape.remark,
    createdAt: SysOrderBaseSchema.shape.createdAt,
    updatedAt: SysOrderBaseSchema.shape.updatedAt,
})
export type SysOrderRespDTO = z.infer<typeof SysOrderRespSchema>

/**
 * 下单结果：余额单返回冻结信息，在线单返回二维码 / 支付链接。
 * `reused=true` 表示命中幂等键（重复提交），前端应提示「订单已存在」而非当成新单。
 */
export const SysOrderCreateRespSchema = z.object({
    orderId: z.string(),
    orderNo: z.string(),
    status: z.string(),
    payMode: z.string(),
    fulfillStatus: z.string(),
    unitPrice: z.string(),
    priceSource: z.string(),
    quantity: z.number(),
    totalAmount: z.string(),
    discountAmount: z.string(),
    payAmount: z.string(),
    giftAmount: z.string(),
    rechargeAmount: z.string(),
    freezeId: z.string().nullish(),
    payOrderId: z.string().nullish(),
    qrImageUrl: z.string().nullish(),
    qrContent: z.string().nullish(),
    payUrl: z.string().nullish(),
    expireAt: z.string().nullish(),
    reused: z.boolean(),
})
export type SysOrderCreateRespDTO = z.infer<typeof SysOrderCreateRespSchema>

/** 确认 / 支付成功 / 关闭结果 */
export const SysOrderSettleRespSchema = z.object({
    orderId: z.string(),
    orderNo: z.string(),
    status: z.string(),
    fulfillStatus: z.string(),
    giftAmount: z.string(),
    rechargeAmount: z.string(),
    reused: z.boolean(),
})
export type SysOrderSettleRespDTO = z.infer<typeof SysOrderSettleRespSchema>

/** 订单看板统计 */
export const SysOrderSummaryRespSchema = z.object({
    /** 区间内订单数（不含已关闭/失败） */
    totalCount: z.number(),
    /** 区间内成交额（应付金额合计，仅已完成） */
    totalAmount: z.string(),
    /** 待支付订单数（全部，不受区间限制） */
    pendingCount: z.number(),
    /** 待交付服务订单数（全部，不受区间限制） */
    pendingFulfillCount: z.number(),
    /** 今日订单数（下单口径） */
    todayCount: z.number(),
    /** 今日成交额（仅已完成） */
    todayAmount: z.string(),
})
export type SysOrderSummaryRespDTO = z.infer<typeof SysOrderSummaryRespSchema>

/** 同步支付状态结果 */
export const SysOrderSyncRespSchema = z.object({
    orderNo: z.string(),
    status: z.string(),
    /** 渠道支付单状态（本地未发起支付时为 null） */
    payOrderStatus: z.string().nullish(),
    /** 本次同步是否推进了订单状态 */
    changed: z.boolean(),
})
export type SysOrderSyncRespDTO = z.infer<typeof SysOrderSyncRespSchema>
