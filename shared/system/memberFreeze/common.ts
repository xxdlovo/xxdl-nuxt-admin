import z from 'zod'

/**
 * 会员消费冻结单基础 Schema —— 与 sys_member_freeze 表结构保持一致。
 * 一张冻结单对应一次「消费预冻结 → 确认扣减 / 释放」的完整过程，
 * 管理端以只读排查为主，写操作只开放「释放」。
 * 所有字段统一 nullish()，便于 pick() / extend() 复用；必填规则在 input.ts 覆盖。
 */
export const SysMemberFreezeBaseSchema = z.object({
    id: z.string().nullish(),
    /** 业务单号，全表唯一（uk_member_freeze_biz） */
    bizNo: z.string().nullish().meta({ query: 'like' }),
    userId: z.string().nullish(),
    /** 冻结总额 = rechargeAmount + giftAmount */
    amount: z.union([z.string(), z.number()]).nullish(),
    /** 其中赠送金额部分 */
    giftAmount: z.union([z.string(), z.number()]).nullish(),
    /** 其中充值本金部分 */
    rechargeAmount: z.union([z.string(), z.number()]).nullish(),
    /** 状态：FROZEN 已冻结 / CONFIRMED 已确认扣减 / RELEASED 已释放 / EXPIRED 已过期 */
    status: z.string().nullish(),
    subject: z.string().nullish().meta({ query: 'like' }),
    /** 业务透传参数（JSON 字符串） */
    attach: z.string().nullish(),
    /** 冻结过期时间 YYYY-MM-DD HH:mm:ss */
    expireAt: z.string().nullish(),
    /** 确认扣减时间 YYYY-MM-DD HH:mm:ss */
    confirmedAt: z.string().nullish(),
    /** 释放时间 YYYY-MM-DD HH:mm:ss */
    releasedAt: z.string().nullish(),
    releaseReason: z.string().nullish(),
    remark: z.string().nullish(),
    createdBy: z.string().nullish(),
    /** 创建时间 YYYY-MM-DD HH:mm:ss */
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    /** 更新时间 YYYY-MM-DD HH:mm:ss */
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysMemberFreezeDto = z.infer<typeof SysMemberFreezeBaseSchema>
