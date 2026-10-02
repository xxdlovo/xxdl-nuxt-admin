import { z } from 'zod'
import { SysMemberBaseSchema } from './common'

/**
 * 会员钱包快照（展示用，字段与 sys_member_wallet 对齐）。
 * 金额列在 MySQL 中是 decimal(12,2)，drizzle 读写均为字符串，故统一用 string。
 */
export const SysMemberWalletRespSchema = z.object({
    /** 充值余额 */
    rechargeBalance: z.string().nullish(),
    /** 赠送金余额 */
    giftBalance: z.string().nullish(),
    /** 冻结中的充值余额 */
    frozenRecharge: z.string().nullish(),
    /** 冻结中的赠送金 */
    frozenGift: z.string().nullish(),
    /** 累计充值 */
    totalRecharge: z.string().nullish(),
    /** 累计获赠 */
    totalGift: z.string().nullish(),
    /** 累计消费 */
    totalConsume: z.string().nullish(),
    currency: z.string().nullish(),
    status: z.number().nullish(),
})
export type SysMemberWalletRespDTO = z.infer<typeof SysMemberWalletRespSchema>

/**
 * 会员档案响应。
 * levelName / nickname / inviterName / wallet 为 Service 关联查询拼装的展示字段，不是 sys_member 表字段，
 * 因此未加入 common.ts 的 Base Schema。
 */
export const SysMemberRespSchema = z.object({
    id: SysMemberBaseSchema.shape.id,
    userId: SysMemberBaseSchema.shape.userId,
    levelId: SysMemberBaseSchema.shape.levelId,
    levelChangedAt: SysMemberBaseSchema.shape.levelChangedAt,
    levelRemark: SysMemberBaseSchema.shape.levelRemark,
    inviteCode: SysMemberBaseSchema.shape.inviteCode,
    inviterId: SysMemberBaseSchema.shape.inviterId,
    inviteCodeId: SysMemberBaseSchema.shape.inviteCodeId,
    invitedAt: SysMemberBaseSchema.shape.invitedAt,
    status: SysMemberBaseSchema.shape.status,
    remark: SysMemberBaseSchema.shape.remark,
    createdAt: SysMemberBaseSchema.shape.createdAt,
    updatedAt: SysMemberBaseSchema.shape.updatedAt,
    /** 展示字段：关联 sys_member_level.name */
    levelName: z.string().nullish(),
    /** 展示字段：关联 sys_user.nickname */
    nickname: z.string().nullish(),
    /** 展示字段：上级会员昵称 */
    inviterName: z.string().nullish(),
    /** 展示字段：余额快照，按需返回（详情页带出，列表页通常不返回） */
    wallet: SysMemberWalletRespSchema.nullish(),
})
export type SysMemberRespDTO = z.infer<typeof SysMemberRespSchema>
