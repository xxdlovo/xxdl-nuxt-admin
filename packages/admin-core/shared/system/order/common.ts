import { z } from 'zod'

/**
 * 订单基础 Schema —— 与 sys_order 表结构保持一致。
 * 所有字段统一 nullish()，便于 pick() / extend() 复用；必填规则在 input.ts 覆盖。
 *
 * 两个维度要分开看：
 * - `status`（WP/OD/CL/FL）只描述**资金**：待支付 / 已完成 / 已关闭 / 发起失败；
 * - `fulfillStatus`（none/pending/delivered）只描述**履约**：是否需要交付、是否已交付。
 *   服务类订单支付成功后进入 pending，后台「交付」后变 delivered；交付不涉及资金。
 */
export const SysOrderBaseSchema = z.object({
    id: z.string().nullish(),
    /** 订单号：同时作为支付单的商户订单号 */
    orderNo: z.string().nullish().meta({ query: 'like' }),
    requestId: z.string().nullish(),
    userId: z.string().nullish(),
    goodsId: z.string().nullish(),
    goodsName: z.string().nullish(),
    goodsCover: z.string().nullish(),
    goodsType: z.string().nullish(),
    unitPrice: z.union([z.string(), z.number()]).nullish(),
    /** base 基础价 / level 等级价 / member 会员协议价(预留) */
    priceSource: z.string().nullish(),
    levelId: z.string().nullish(),
    quantity: z.number().nullish(),
    totalAmount: z.union([z.string(), z.number()]).nullish(),
    discountAmount: z.union([z.string(), z.number()]).nullish(),
    payAmount: z.union([z.string(), z.number()]).nullish(),
    giftAmount: z.union([z.string(), z.number()]).nullish(),
    rechargeAmount: z.union([z.string(), z.number()]).nullish(),
    payMode: z.string().nullish(),
    status: z.string().nullish(),
    couponId: z.string().nullish(),
    couponCode: z.string().nullish().meta({ query: 'like' }),
    freezeId: z.string().nullish(),
    payOrderId: z.string().nullish(),
    payChannelCode: z.string().nullish(),
    contact: z.string().nullish(),
    fulfillStatus: z.string().nullish(),
    fulfilledAt: z.string().nullish(),
    fulfillRemark: z.string().nullish(),
    fulfillOperatorId: z.string().nullish(),
    expireAt: z.string().nullish(),
    paidAt: z.string().nullish(),
    finishedAt: z.string().nullish(),
    closedAt: z.string().nullish(),
    closeReason: z.string().nullish(),
    failReason: z.string().nullish(),
    remark: z.string().nullish(),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysOrderDto = z.infer<typeof SysOrderBaseSchema>
