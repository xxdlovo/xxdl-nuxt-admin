import { z } from 'zod'
import { SysMemberBaseSchema, SysMemberAccountSchema } from './common'
import { ApiRequestSchema } from '#shared/types/common'

// 新增：管理端手工建档（正常注册由 Service 在用户创建后自动开档）
export const SysMemberAddSchema = SysMemberBaseSchema.pick({
    userId: true,
    levelId: true,
    levelRemark: true,
    expireAt: true,
    inviteCode: true,
    inviterId: true,
    inviteCodeId: true,
    status: true,
    remark: true,
}).extend({
    id: SysMemberBaseSchema.shape.id.nonoptional(),
    userId: z.string().min(1, 'form.required').max(36, 'form.required'),
    levelId: z.string().max(36).nullish(),
    levelRemark: z.string().max(255).nullish(),
    /** 当前等级到期时间 YYYY-MM-DD HH:mm:ss；留空 = 永不过期（长期/默认等级） */
    expireAt: z.string().max(30).nullish(),
    /** 邀请码：表内唯一，留空由服务端生成，填了则校验唯一性 */
    inviteCode: z.string().max(20).nullish(),
    inviterId: z.string().max(36).nullish(),
    inviteCodeId: z.string().max(36).nullish(),
    status: z.number().default(1),
    remark: z.string().max(255).nullish(),
})
export type SysMemberAddDTO = z.infer<typeof SysMemberAddSchema>

// 修改：只允许改可编辑字段；userId / inviteCode 建档后不可变，故不在此列
export const SysMemberUpdateSchema = SysMemberBaseSchema.pick({
    levelId: true,
    levelRemark: true,
    expireAt: true,
    status: true,
    remark: true,
}).extend({
    id: z.string().nonempty('form.id.required'),
    levelId: z.string().max(36).nullish(),
    levelRemark: z.string().max(255).nullish(),
    /** 当前等级到期时间 YYYY-MM-DD HH:mm:ss；null = 清除到期时间（改为永不过期） */
    expireAt: z.string().max(30).nullish(),
    status: z.number().nullish(),
    remark: z.string().max(255).nullish(),
})
export type SysMemberUpdateDTO = z.infer<typeof SysMemberUpdateSchema>

// 查询条件
export const SysMemberQuerySchema = SysMemberBaseSchema.pick({
    id: true,
    userId: true,
    levelId: true,
    inviteCode: true,
    inviterId: true,
    inviteCodeId: true,
    levelChangedAt: true,
    invitedAt: true,
    status: true,
    remark: true,
}).extend({
    /** 关键字：匹配昵称 / 用户名 / 手机号 / 邀请码（非表字段，由 Repo 消费） */
    keyword: z.string().max(50).nullish(),
    /** 注册时间区间，格式 YYYY-MM-DD HH:mm:ss（非表字段，由 Repo 消费） */
    createdFrom: z.string().max(30).nullish(),
    createdTo: z.string().max(30).nullish(),
})
export type SysMemberQueryDTO = z.infer<typeof SysMemberQuerySchema>

// 分页查询：查询条件 + 分页参数
export const SysMemberPageQuerySchema =
    SysMemberQuerySchema.extend(ApiRequestSchema.shape)
export type SysMemberPageQueryDTO = z.infer<typeof SysMemberPageQuerySchema>

/**
 * 手工调账（后台运营）：充值余额 / 赠送金 的加扣。
 * requestId 为幂等键，前端每次提交生成，服务端据此防止重复提交与重复入账。
 */
export const SysMemberAdjustSchema = z.object({
    userId: z.string().min(1, 'form.required').max(36, 'form.required'),
    account: SysMemberAccountSchema,
    /** 方向：in 增加 / out 扣减 */
    direction: z.enum(['in', 'out']),
    amount: z.union([z.string(), z.number()]),
    reason: z.string().min(1, 'form.required').max(255, 'form.required'),
    /** 幂等键：服务端会拼成 `adjust:{requestId}` 写入 biz_no(varchar(64))，因此上限 36 */
    requestId: z.string().min(1, 'form.required').max(36, 'form.required'),
    remark: z.string().max(255).nullish(),
})
export type SysMemberAdjustDTO = z.infer<typeof SysMemberAdjustSchema>

/**
 * 发放赠送金：source 区分系统手动发放与活动发放，expireAt 格式 YYYY-MM-DD HH:mm:ss，留空表示永久有效。
 * requestId 为幂等键（前端每次提交生成），避免连点或重试造成重复发放。
 */
export const SysMemberGrantSchema = z.object({
    userId: z.string().min(1, 'form.required').max(36, 'form.required'),
    amount: z.union([z.string(), z.number()]),
    source: z.enum(['system', 'campaign']),
    expireAt: z.string().max(30).nullish(),
    /** 幂等键：服务端会拼成 `gift:{requestId}` 写入 biz_no(varchar(64))，因此上限 36 */
    requestId: z.string().min(1, 'form.required').max(36, 'form.required'),
    remark: z.string().max(255).nullish(),
})
export type SysMemberGrantDTO = z.infer<typeof SysMemberGrantSchema>

/**
 * 变更会员等级：写入 levelId 的同时记录 levelChangedAt / levelRemark。
 *
 * 期限参数二选一，语义如下：
 * - `longTerm = true`：按长期处理，服务端把 `sys_member.expire_at` 置 NULL（永不过期），
 *   并写 levelSource（默认 manual）；传了 longTerm 时忽略 expireAt；
 * - `expireAt`：显式到期时间（YYYY-MM-DD HH:mm:ss），null = 清除到期（等同长期）；
 * - 两者都不传：服务端按目标等级的 durationDays 推导到期时间
 *   （durationDays=0 或 isLongTerm=1 时置 NULL），并在得到 null 时把 levelSource 标为 manual。
 *
 * 注意：本 Schema 只做形态校验，「到期时间是否合法 / 是否允许长期」由 Service 判定。
 */
export const SysMemberChangeLevelSchema = z.object({
    userId: z.string().min(1, 'form.required').max(36, 'form.required'),
    levelId: z.string().min(1, 'form.required').max(36, 'form.required'),
    /** 到期时间 YYYY-MM-DD HH:mm:ss；null = 长期 / 清除到期 */
    expireAt: z.string().max(30).nullish(),
    /** true 表示按长期处理（服务端据此把 expire_at 置 NULL）；兼容布尔与 1/0 */
    longTerm: z.union([z.number(), z.boolean()]).nullish(),
    remark: z.string().max(255).nullish(),
})
export type SysMemberChangeLevelDTO = z.infer<typeof SysMemberChangeLevelSchema>

/**
 * 关于「给会员发券」：当前数据模型里优惠码是**凭码使用**（不绑定持有关系），
 * 因此「发券」等价于在优惠码模块创建一枚码（可设置 perUserLimit=1），
 * 不存在会员-券的持有表，故这里不提供发券 Schema。
 */

/** 查询条件：本人资金流水（自助） */
export const SysMemberMyLogFilterSchema = z.object({
    /** 资金账户，留空表示全部账户 */
    account: SysMemberAccountSchema.nullish(),
    /** 业务类型：recharge / consume / adjust / gift / refund 等，由服务端定义 */
    bizType: z.string().max(30).nullish(),
    /** 起始时间，格式 YYYY-MM-DD HH:mm:ss */
    createdFrom: z.string().max(30).nullish(),
    /** 结束时间，格式 YYYY-MM-DD HH:mm:ss */
    createdTo: z.string().max(30).nullish(),
})

/**
 * 自助查询本人流水：userId 由服务端从会话推导，前端不传，因此这里只声明筛选与分页参数。
 * createdFrom / createdTo 不是表字段，由服务端 Repo 用区间条件消费。
 */
export const SysMemberMyLogQuerySchema =
    SysMemberMyLogFilterSchema.extend(ApiRequestSchema.shape)
export type SysMemberMyLogQueryDTO = z.infer<typeof SysMemberMyLogQuerySchema>

/**
 * 自助发起充值：入库前由服务端按 user 会话归属，amount 为充值金额（非实付金额）。
 *
 * 这个 Schema 的**唯一定义在 `shared/system/memberRecharge`**（充值域的归属模块），
 * 会员自助接口直接复用 `SysMemberRechargeCreateSchema`，避免两处同名同义定义漂移。
 */

/**
 * 会员用户下拉搜索（后台选人，供建档 / 补录充值 / 流水筛选复用）。
 * - `scope = 'member'`：只列已有会员档案的用户；
 * - `scope = 'unprofiled'`：只列还没有档案的用户（建档弹窗用，避免选到已有档案的人）。
 */
export const SysMemberUserOptionQuerySchema = z.object({
    keyword: z.string().max(50).nullish(),
    limit: z.number().int().min(1).max(50).default(20),
    scope: z.enum(['member', 'unprofiled']).default('member'),
})
export type SysMemberUserOptionQueryDTO = z.infer<typeof SysMemberUserOptionQuerySchema>

/**
 * 自助校验优惠码（下单 / 充值前主动校验，避免提交后才报错）。
 * `amount` 可空：为空时只校验「券本身是否可用」（存在、启用、在有效期内、场景匹配、次数未超），
 * 门槛与抵扣金额等填了金额再算。
 * `scene` 默认充值；商城下单传 `consume`。
 */
export const SysMemberCouponCheckSchema = z.object({
    code: z.string().min(1, 'form.required').max(32, 'form.required'),
    amount: z.union([z.string(), z.number()]).nullish(),
    scene: z.enum(['recharge', 'consume']).default('recharge'),
})
export type SysMemberCouponCheckDTO = z.infer<typeof SysMemberCouponCheckSchema>

