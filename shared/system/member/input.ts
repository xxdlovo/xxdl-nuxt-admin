import { z } from 'zod'
import { SysMemberBaseSchema, SysMemberAccountSchema } from './common'
import { ApiRequestSchema } from '#shared/types/common'

// 新增：管理端手工建档（正常注册由 Service 在用户创建后自动开档）
export const SysMemberAddSchema = SysMemberBaseSchema.pick({
    userId: true,
    levelId: true,
    levelRemark: true,
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
    status: true,
    remark: true,
}).extend({
    id: z.string().nonempty('form.id.required'),
    levelId: z.string().max(36).nullish(),
    levelRemark: z.string().max(255).nullish(),
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
    requestId: z.string().min(1, 'form.required').max(64, 'form.required'),
    remark: z.string().max(255).nullish(),
})
export type SysMemberAdjustDTO = z.infer<typeof SysMemberAdjustSchema>

/** 发放赠送金：source 区分系统手动发放与活动发放，expireAt 格式 YYYY-MM-DD HH:mm:ss，留空表示永久有效 */
export const SysMemberGrantSchema = z.object({
    userId: z.string().min(1, 'form.required').max(36, 'form.required'),
    amount: z.union([z.string(), z.number()]),
    source: z.enum(['system', 'campaign']),
    expireAt: z.string().max(30).nullish(),
    remark: z.string().max(255).nullish(),
})
export type SysMemberGrantDTO = z.infer<typeof SysMemberGrantSchema>

/** 变更会员等级：写入 levelId 的同时记录 levelChangedAt / levelRemark */
export const SysMemberChangeLevelSchema = z.object({
    userId: z.string().min(1, 'form.required').max(36, 'form.required'),
    levelId: z.string().min(1, 'form.required').max(36, 'form.required'),
    remark: z.string().max(255).nullish(),
})
export type SysMemberChangeLevelDTO = z.infer<typeof SysMemberChangeLevelSchema>

/** 给会员发券：couponId 与 couponCode 至少填其一（优惠券表 id 36 位，code 32 位） */
export const SysMemberCouponGrantSchema = z
    .object({
        userId: z.string().min(1, 'form.required').max(36, 'form.required'),
        couponId: z.string().max(36).nullish(),
        couponCode: z.string().max(32).nullish(),
        remark: z.string().max(255).nullish(),
    })
    .refine(
        data => Boolean(data.couponId?.trim()) || Boolean(data.couponCode?.trim()),
        {
            message: 'form.required',
            path: ['couponId'],
        }
    )
export type SysMemberCouponGrantDTO = z.infer<typeof SysMemberCouponGrantSchema>

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
