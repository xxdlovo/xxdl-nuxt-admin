import { z } from 'zod'
import { SysMemberFreezeBaseSchema } from './common'

/** 冻结单响应：列表与详情共用；金额保持 decimal 字符串形态 */
export const SysMemberFreezeRespSchema = z.object({
    id: SysMemberFreezeBaseSchema.shape.id,
    bizNo: SysMemberFreezeBaseSchema.shape.bizNo,
    userId: SysMemberFreezeBaseSchema.shape.userId,
    amount: SysMemberFreezeBaseSchema.shape.amount,
    giftAmount: SysMemberFreezeBaseSchema.shape.giftAmount,
    rechargeAmount: SysMemberFreezeBaseSchema.shape.rechargeAmount,
    status: SysMemberFreezeBaseSchema.shape.status,
    subject: SysMemberFreezeBaseSchema.shape.subject,
    attach: SysMemberFreezeBaseSchema.shape.attach,
    expireAt: SysMemberFreezeBaseSchema.shape.expireAt,
    confirmedAt: SysMemberFreezeBaseSchema.shape.confirmedAt,
    releasedAt: SysMemberFreezeBaseSchema.shape.releasedAt,
    releaseReason: SysMemberFreezeBaseSchema.shape.releaseReason,
    remark: SysMemberFreezeBaseSchema.shape.remark,
    createdAt: SysMemberFreezeBaseSchema.shape.createdAt,
    updatedAt: SysMemberFreezeBaseSchema.shape.updatedAt,
})
export type SysMemberFreezeRespDTO = z.infer<typeof SysMemberFreezeRespSchema>
