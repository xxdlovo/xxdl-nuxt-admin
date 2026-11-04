import z from 'zod'

/**
 * 会员档案基础 Schema —— 与 sys_member 表结构保持一致。
 * 所有字段统一 nullish()，便于 pick() / extend() 复用；必填规则在 input.ts 覆盖。
 * levelChangedAt / invitedAt / expireAt / levelStartAt / createdAt / updatedAt 均为字符串，
 * 格式 YYYY-MM-DD HH:mm:ss。
 * 注意：nickname / levelName / wallet 等展示字段不属于本表，只出现在 output.ts。
 *
 * 等级期限语义：
 * - `expireAt` 为**当前等级到期时间**，NULL 表示永不过期（长期等级 / 默认等级）；
 * - `levelStartAt` 为当前等级生效时间；
 * - `levelSource` 为等级来源：manual 手工 / open 新开通 / renew 续费 / upgrade 升级 /
 *   default 注册默认分配 / auto_expire 到期降级。
 */
export const SysMemberBaseSchema = z.object({
    id: z.string().nullish(),
    userId: z.string().nullish().meta({ query: 'like' }),
    levelId: z.string().nullish(),
    /** 最近一次等级变更时间 */
    levelChangedAt: z.string().nullish(),
    /** 等级变更备注（与 remark 区分：仅记录等级相关说明） */
    levelRemark: z.string().nullish(),
    /** 当前等级到期时间；NULL 表示永不过期（长期/默认等级） */
    expireAt: z.string().nullish(),
    /** 当前等级生效时间 */
    levelStartAt: z.string().nullish(),
    /** 等级来源：manual/open/renew/upgrade/default/auto_expire */
    levelSource: z.string().nullish(),
    inviteCode: z.string().nullish().meta({ query: 'like' }),
    inviterId: z.string().nullish(),
    inviteCodeId: z.string().nullish(),
    /** 邀请关系绑定时间 */
    invitedAt: z.string().nullish(),
    status: z.number().nullish(),
    remark: z.string().nullish(),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysMemberDto = z.infer<typeof SysMemberBaseSchema>

/** 会员资金账户：recharge 充值余额 / gift 赠送金（与 sys_member_wallet、sys_member_balance_log.account 对应） */
export const SysMemberAccountSchema = z.enum(['recharge', 'gift'])
export type SysMemberAccountDTO = z.infer<typeof SysMemberAccountSchema>
