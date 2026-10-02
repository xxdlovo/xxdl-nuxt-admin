import { z } from 'zod'
import { SysMemberRechargeBaseSchema } from './common'

/** 充值单响应：列表与详情共用；amount / payAmount 保持 decimal 字符串形态 */
export const SysMemberRechargeRespSchema = z.object({
    id: SysMemberRechargeBaseSchema.shape.id,
    outTradeNo: SysMemberRechargeBaseSchema.shape.outTradeNo,
    userId: SysMemberRechargeBaseSchema.shape.userId,
    amount: SysMemberRechargeBaseSchema.shape.amount,
    giftAmount: SysMemberRechargeBaseSchema.shape.giftAmount,
    discountAmount: SysMemberRechargeBaseSchema.shape.discountAmount,
    payAmount: SysMemberRechargeBaseSchema.shape.payAmount,
    couponId: SysMemberRechargeBaseSchema.shape.couponId,
    couponCode: SysMemberRechargeBaseSchema.shape.couponCode,
    status: SysMemberRechargeBaseSchema.shape.status,
    payOrderId: SysMemberRechargeBaseSchema.shape.payOrderId,
    payChannelCode: SysMemberRechargeBaseSchema.shape.payChannelCode,
    paidAt: SysMemberRechargeBaseSchema.shape.paidAt,
    creditedAt: SysMemberRechargeBaseSchema.shape.creditedAt,
    expireAt: SysMemberRechargeBaseSchema.shape.expireAt,
    failReason: SysMemberRechargeBaseSchema.shape.failReason,
    remark: SysMemberRechargeBaseSchema.shape.remark,
    createdAt: SysMemberRechargeBaseSchema.shape.createdAt,
    updatedAt: SysMemberRechargeBaseSchema.shape.updatedAt,
})
export type SysMemberRechargeRespDTO = z.infer<typeof SysMemberRechargeRespSchema>
