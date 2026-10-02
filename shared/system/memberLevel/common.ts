import z from 'zod'

/**
 * 会员等级基础 Schema —— 与 sys_member_level 表结构保持一致。
 * 所有字段统一 nullish()，便于 pick() / extend() 复用；必填规则在 input.ts 覆盖。
 * createdAt / updatedAt / levelChangedAt 等时间字段均为字符串，格式 YYYY-MM-DD HH:mm:ss。
 */
export const SysMemberLevelBaseSchema = z.object({
    id: z.string().nullish(),
    code: z.string().nullish().meta({ query: 'like' }),
    name: z.string().nullish().meta({ query: 'like' }),
    sortOrder: z.number().nullish(),
    benefit: z.string().nullish().meta({ query: 'like' }),
    status: z.number().nullish(),
    remark: z.string().nullish(),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysMemberLevelDto = z.infer<typeof SysMemberLevelBaseSchema>
