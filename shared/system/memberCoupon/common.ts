import z from 'zod'

/**
 * 会员优惠码基础 Schema —— 与 sys_member_coupon 表结构保持一致。
 * 所有字段统一 nullish()，便于 pick() / extend() 复用；必填规则在 input.ts 覆盖。
 * 金额字段在 MySQL 中是 decimal(12,2)，drizzle 读出为字符串；
 * 这里用 string | number 兼容表单直接传数字。
 */
export const SysMemberCouponBaseSchema = z.object({
    id: z.string().nullish(),
    /** 优惠码，全表唯一（uk_member_coupon_code） */
    code: z.string().nullish().meta({ query: 'like' }),
    name: z.string().nullish().meta({ query: 'like' }),
    /** 优惠类型：amount 固定金额 / discount 折扣 / gift 赠送金额 */
    type: z.string().nullish(),
    value: z.union([z.string(), z.number()]).nullish(),
    minAmount: z.union([z.string(), z.number()]).nullish(),
    /** 适用场景：all 通用 / recharge 充值 / consume 消费 */
    scene: z.string().nullish(),
    giftAmount: z.union([z.string(), z.number()]).nullish(),
    /** 生效时间 YYYY-MM-DD HH:mm:ss */
    validFrom: z.string().nullish(),
    /** 失效时间 YYYY-MM-DD HH:mm:ss */
    validTo: z.string().nullish(),
    /** 最大可用次数，0 表示不限 */
    maxUse: z.number().nullish(),
    usedCount: z.number().nullish(),
    perUserLimit: z.number().nullish(),
    batchNo: z.string().nullish().meta({ query: 'like' }),
    /** 状态：1 启用 / 0 停用 / -1 已作废 */
    status: z.number().nullish(),
    remark: z.string().nullish(),
    createdBy: z.string().nullish(),
    /** 创建时间 YYYY-MM-DD HH:mm:ss */
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    /** 更新时间 YYYY-MM-DD HH:mm:ss */
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysMemberCouponDto = z.infer<typeof SysMemberCouponBaseSchema>
