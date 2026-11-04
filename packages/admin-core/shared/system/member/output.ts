import { z } from 'zod'
import { SysMemberBaseSchema } from './common'

/**
 * 优惠码校验结果（充值 / 下单前主动校验）。
 *
 * - `valid = false` 时 `reason` 是 i18n key（如 `module.system.member.couponExpired`），前端直接 `$ts(reason)`；
 * - 未填金额时只返回券面信息（`minAmount/value/giftAmount`），`discountAmount/payableAmount` 为 null，
 *   前端提示「满 X 元可用」即可，不要显示抵扣额。
 */
export const SysMemberCouponCheckRespSchema = z.object({
    valid: z.boolean(),
    reason: z.string().nullish(),
    code: z.string().nullish(),
    /** amount 固定金额抵扣 / rate 折扣率 */
    type: z.string().nullish(),
    /** amount 类型=抵扣金额；rate 类型=应付比例（0.90 表示九折） */
    value: z.string().nullish(),
    /** 使用门槛（元），0 表示无门槛 */
    minAmount: z.string().nullish(),
    /**
     * 「优惠码面值大于订单金额」时需要达到的金额（元）。
     * 与 `minAmount` 互斥：`reason = couponNotApplicable` 时用它提示「需满足 ¥X 才可使用」。
     */
    requiredAmount: z.string().nullish(),
    /** 附带赠送金（元） */
    giftAmount: z.string().nullish(),
    /** 抵扣金额（元）；未填金额时为 null */
    discountAmount: z.string().nullish(),
    /** 抵扣后应付（元）；未填金额时为 null */
    payableAmount: z.string().nullish(),
})
export type SysMemberCouponCheckRespDTO = z.infer<typeof SysMemberCouponCheckRespSchema>

/**
 * 会员等级「不能开通 / 续费」的原因码（稳定码，不返回中文）。
 *
 * 文案由前端按码映射（`module.system.profile.memberBlocked*`），服务端抛错时把
 * 同一语义写成 `module.system.memberLevelOrder.*` 的 i18n key，两边措辞保持一致：
 * - `freeAlreadyOpened`：0 元等级已激活，或该用户已有过该等级的免费成功单据
 *   → 价格为 0 的等级不支持重复开通 / 续费（没开通过的免费等级仍可开通）；
 * - `longTermActive`：长期等级且已激活 → 长期等级没有到期时间可续，续费无意义。
 */
export const SysMemberLevelBlockedReasonSchema = z.enum(['freeAlreadyOpened', 'longTermActive'])
export type SysMemberLevelBlockedReason = z.infer<typeof SysMemberLevelBlockedReasonSchema>

/**
 * 个人中心「开通会员等级」列表项（`sysMember.myLevelOptions` 返回项）。
 *
 * 前半部分是等级字典（sys_member_level）的对外投影，与后台等级响应同口径
 * （`isDeleted` / `createdBy` 等内部字段不透出）；
 * 后半部分 `isCurrent` / `isActive` / `canOpen` / `blockedReason` 是服务端按同一份规则
 * 算好的开通决策（规则唯一来源见 server/trade-router/domain/member/levelOpenPolicy.ts），
 * 前端只消费结论，不再自己推导「能不能开通」。
 *
 * 字段一律 nullish()，与 shared 其他 Schema 的宽松风格一致；决策字段是服务端必给的，
 * 因此声明为必填（只可能为 null 的 `blockedReason` 用 nullish）。
 */
export const SysMemberLevelOptionSchema = z.object({
    id: z.string().nullish(),
    code: z.string().nullish(),
    name: z.string().nullish(),
    sortOrder: z.number().nullish(),
    benefit: z.string().nullish(),
    /** 等级售价（元，2 位小数字符串）；'0.00' 表示免费等级 */
    price: z.string().nullish(),
    /** 购买一次的有效天数；0 表示不设期限（按长期处理） */
    durationDays: z.number().nullish(),
    /** 是否默认等级：0 否 / 1 是 */
    isDefault: z.number().nullish(),
    /** 是否长期等级：0 否 / 1 是 */
    isLongTerm: z.number().nullish(),
    status: z.number().nullish(),
    remark: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedAt: z.string().nullish(),
    /** 该等级是否就是当前会员等级（前端「当前等级」标记） */
    isCurrent: z.boolean(),
    /**
     * 该等级就是当前等级且仍在有效期内：`expireAt = null`（永不过期）或未到期。
     * 前端「已激活」徽标的唯一判定依据；当前等级但未激活 → 展示「已过期」。
     */
    isActive: z.boolean(),
    /** 是否允许点「开通 / 续费」 */
    canOpen: z.boolean(),
    /** 不能开通的原因码；允许开通时为 null */
    blockedReason: SysMemberLevelBlockedReasonSchema.nullish(),
})
export type SysMemberLevelOptionDTO = z.infer<typeof SysMemberLevelOptionSchema>

/** 可开通等级列表（`sysMember.myLevelOptions`） */
export const SysMemberLevelOptionRespSchema = z.array(SysMemberLevelOptionSchema)
export type SysMemberLevelOptionRespDTO = z.infer<typeof SysMemberLevelOptionRespSchema>

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
 * expireAt / levelStartAt / levelSource 是 sys_member 表字段（等级期限与来源）。
 */
export const SysMemberRespSchema = z.object({
    id: SysMemberBaseSchema.shape.id,
    userId: SysMemberBaseSchema.shape.userId,
    levelId: SysMemberBaseSchema.shape.levelId,
    levelChangedAt: SysMemberBaseSchema.shape.levelChangedAt,
    levelRemark: SysMemberBaseSchema.shape.levelRemark,
    /** 当前等级到期时间；null = 永不过期（长期/默认等级） */
    expireAt: SysMemberBaseSchema.shape.expireAt,
    /** 当前等级生效时间 */
    levelStartAt: SysMemberBaseSchema.shape.levelStartAt,
    /** 等级来源：manual/open/renew/upgrade/default/auto_expire */
    levelSource: SysMemberBaseSchema.shape.levelSource,
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
    /**
     * 展示字段（派生）：当前等级的时长天数，用于前端展示「已开通 X 天」。
     * 来源：Service 联表 sys_member_level.duration_days 带出；等级未配置或被删除时为 null。
     */
    levelDurationDays: z.number().nullish(),
    /**
     * 展示字段（派生）：当前等级是否长期（0 否 / 1 是），与 sys_member_level.is_long_term 对齐。
     * 来源：Service 联表 sys_member_level.is_long_term 带出；等级未配置或被删除时为 null。
     * 与 `expireAt = null` 的关系：长期等级必有 expireAt = null，但 expireAt = null 也可能是
     * 默认等级或后台手工清除到期时间，故两者不能互相推导，前端判断「永不过期」应以 expireAt 为准。
     */
    levelIsLongTerm: z.number().nullish(),
    /**
     * 展示字段（派生）：当前等级的售价（元，2 位小数字符串）。
     * 来源：Service 联表 sys_member_level.price 带出；等级未配置或被删除时为 null。
     */
    levelPrice: z.string().nullish(),
    /**
     * 展示字段（派生）：当前等级是否默认等级（0 否 / 1 是），与 sys_member_level.is_default 对齐。
     * 来源：Service 联表带出；新注册用户会被自动分配默认等级且永不过期。
     */
    levelIsDefault: z.number().nullish(),
    /** 展示字段：余额快照，按需返回（详情页带出，列表页通常不返回） */
    wallet: SysMemberWalletRespSchema.nullish(),
})
export type SysMemberRespDTO = z.infer<typeof SysMemberRespSchema>
