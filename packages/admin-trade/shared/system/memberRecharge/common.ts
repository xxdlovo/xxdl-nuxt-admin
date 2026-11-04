import z from 'zod'

/**
 * 会员充值单基础 Schema —— 与 sys_member_recharge 表结构保持一致。
 * 所有字段统一 nullish()，便于 pick() / extend() 复用；必填规则在 input.ts 覆盖。
 * 金额字段均为 decimal(12,2)，用 string | number 兼容表单直接传数字。
 */
export const SysMemberRechargeBaseSchema = z.object({
    id: z.string().nullish(),
    /** 商户充值单号，全表唯一（uk_member_recharge_out） */
    outTradeNo: z.string().nullish().meta({ query: 'like' }),
    userId: z.string().nullish(),
    /** 充值面额（实际到账本金） */
    amount: z.union([z.string(), z.number()]).nullish(),
    /** 赠送金额 */
    giftAmount: z.union([z.string(), z.number()]).nullish(),
    /** 优惠码抵扣金额 */
    discountAmount: z.union([z.string(), z.number()]).nullish(),
    /** 实付金额 = amount - discountAmount */
    payAmount: z.union([z.string(), z.number()]).nullish(),
    couponId: z.string().nullish(),
    couponCode: z.string().nullish(),
    /** 状态：WP 待支付 / OD 已支付（已到账）/ CL 已关闭 / FL 发起失败 */
    status: z.string().nullish(),
    /** 关联的 sys_pay_order.id */
    payOrderId: z.string().nullish(),
    payChannelCode: z.string().nullish(),
    /** 支付时间 YYYY-MM-DD HH:mm:ss */
    paidAt: z.string().nullish(),
    /** 入账时间 YYYY-MM-DD HH:mm:ss */
    creditedAt: z.string().nullish(),
    /** 支付超时时间 YYYY-MM-DD HH:mm:ss */
    expireAt: z.string().nullish(),
    failReason: z.string().nullish(),
    remark: z.string().nullish(),
    createdBy: z.string().nullish(),
    /** 创建时间 YYYY-MM-DD HH:mm:ss */
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    /** 更新时间 YYYY-MM-DD HH:mm:ss */
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysMemberRechargeDto = z.infer<typeof SysMemberRechargeBaseSchema>
