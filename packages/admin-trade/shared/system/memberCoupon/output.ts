import { z } from 'zod'
import { SysMemberCouponBaseSchema } from './common'

/**
 * 优惠码响应：列表与详情共用。
 * usedRate 不是表字段，是 Service 依据 usedCount / maxUse 计算的可选派生值，
 * maxUse 为 0（不限次）时保持 null，由前端决定展示「不限」还是百分比。
 */
export const SysMemberCouponRespSchema = z.object({
    id: SysMemberCouponBaseSchema.shape.id,
    code: SysMemberCouponBaseSchema.shape.code,
    name: SysMemberCouponBaseSchema.shape.name,
    type: SysMemberCouponBaseSchema.shape.type,
    value: SysMemberCouponBaseSchema.shape.value,
    minAmount: SysMemberCouponBaseSchema.shape.minAmount,
    scene: SysMemberCouponBaseSchema.shape.scene,
    giftAmount: SysMemberCouponBaseSchema.shape.giftAmount,
    validFrom: SysMemberCouponBaseSchema.shape.validFrom,
    validTo: SysMemberCouponBaseSchema.shape.validTo,
    maxUse: SysMemberCouponBaseSchema.shape.maxUse,
    usedCount: SysMemberCouponBaseSchema.shape.usedCount,
    perUserLimit: SysMemberCouponBaseSchema.shape.perUserLimit,
    batchNo: SysMemberCouponBaseSchema.shape.batchNo,
    status: SysMemberCouponBaseSchema.shape.status,
    remark: SysMemberCouponBaseSchema.shape.remark,
    createdAt: SysMemberCouponBaseSchema.shape.createdAt,
    updatedAt: SysMemberCouponBaseSchema.shape.updatedAt,
    /** 已用比例，0~100 的两位小数字符串；maxUse 为 0 时为 null */
    usedRate: z.string().nullish(),
})
export type SysMemberCouponRespDTO = z.infer<typeof SysMemberCouponRespSchema>
