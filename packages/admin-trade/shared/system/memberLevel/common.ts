import z from 'zod'

/**
 * 会员等级基础 Schema —— 与 sys_member_level 表结构保持一致。
 * 所有字段统一 nullish()，便于 pick() / extend() 复用；必填规则在 input.ts 覆盖。
 * createdAt / updatedAt / levelChangedAt 等时间字段均为字符串，格式 YYYY-MM-DD HH:mm:ss。
 * 金额字段在 MySQL 中是 decimal(12,2)，drizzle 读出为字符串，这里用 string | number 兼容表单。
 *
 * 价格与期限的业务规则（校验在 Service 层做，Schema 只描述形态）：
 * - `price > 0` 的付费等级：`isLongTerm` 必须为 0，且 `durationDays >= 1`（按天售卖）；
 * - `price = 0` 的免费等级：`durationDays` 可为 0，此时表示不设期限（长期等级）。
 */
export const SysMemberLevelBaseSchema = z.object({
    id: z.string().nullish(),
    code: z.string().nullish().meta({ query: 'like' }),
    name: z.string().nullish().meta({ query: 'like' }),
    sortOrder: z.number().nullish(),
    benefit: z.string().nullish().meta({ query: 'like' }),
    /** 等级售价（元）；0 表示免费等级 */
    price: z.union([z.string(), z.number()]).nullish(),
    /** 购买一次的有效天数；0 表示不设期限（长期等级） */
    durationDays: z.number().nullish(),
    /** 是否默认等级：1 是（全局唯一，新用户注册自动分配且永不过期） */
    isDefault: z.number().nullish(),
    /** 是否长期等级：1 是（仅 price=0 可设，该等级会员永不过期） */
    isLongTerm: z.number().nullish(),
    status: z.number().nullish(),
    remark: z.string().nullish(),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysMemberLevelDto = z.infer<typeof SysMemberLevelBaseSchema>
