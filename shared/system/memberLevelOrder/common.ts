import z from 'zod'

/**
 * 会员开通单基础 Schema —— 与 sys_member_level_order 表结构保持一致。
 * 所有字段统一 nullish()，便于 pick() / extend() 复用；必填规则在 input.ts 覆盖。
 * 金额字段均为 decimal(12,2)，用 string | number 兼容表单直接传数字。
 * 时间字段均为字符串，格式 YYYY-MM-DD HH:mm:ss。
 *
 * 与其他单据的关系：
 * - 余额支付走 sys_member_freeze（freeze_id），在线支付走 sys_pay_order（pay_order_id）；
 * - 价格 = 0 的免费等级不走任何支付，pay_mode = 'free'，创建即生效（status = 'OD'）。
 *
 * 幂等：
 * - 单据级由 `requestId` 的唯一键（uk_member_level_order_request）保证，同一 requestId 只落一单；
 * - 资金层由冻结单 biz_no（`mlv:{requestId}`）保证，两层都不重复扣款。
 *
 * 注意 `expireAt` 的含义：本表（与 sys_member_recharge / sys_order 一致）是**支付超时时间**；
 * `sys_member.expire_at` 是**等级到期时间**，两者语义不同，不要混用。
 * 本单产生的等级有效期区间记在 startAt / endAt（endAt 为 null 表示长期/不设期限）。
 */

/** 支付方式：balance 余额支付 / online 在线支付 / free 免费等级直接生效（服务端在 price=0 时写入，用户不可选） */
export const SysMemberLevelOrderPayModeSchema = z.enum(['balance', 'online', 'free'])
export type SysMemberLevelOrderPayModeDTO = z.infer<typeof SysMemberLevelOrderPayModeSchema>

/** 单据状态：WP 待支付 / OD 已生效 / CL 已关闭 / FL 失败 */
export const SysMemberLevelOrderStatusSchema = z.enum(['WP', 'OD', 'CL', 'FL'])
export type SysMemberLevelOrderStatusDTO = z.infer<typeof SysMemberLevelOrderStatusSchema>

export const SysMemberLevelOrderBaseSchema = z.object({
    id: z.string().nullish(),
    /** 商户订单号，全表唯一（uk_member_level_order_out），同时作为支付单的商户订单号 */
    outTradeNo: z.string().nullish().meta({ query: 'like' }),
    /**
     * 下单请求幂等键（自助开通时由前端每次提交生成），全表唯一
     * （uk_member_level_order_request）：同一 requestId 只允许一张开通单，重复提交命中唯一键即复用原单。
     * 可空 —— MySQL 唯一索引允许多个 NULL，故 request_id 为空的行不参与唯一约束
     * （后台补录 / 历史数据为空值，此时不具备幂等语义）。
     */
    requestId: z.string().nullish(),
    /** 开通会员的用户ID（sys_user.id） */
    userId: z.string().nullish(),
    /** 开通的会员等级ID（sys_member_level.id） */
    levelId: z.string().nullish(),
    /** 等级名称快照（下单时点的名称，等级改名不影响历史单据） */
    levelName: z.string().nullish(),
    /** 本单时长天数快照；0 表示不设期限（长期） */
    durationDays: z.number().nullish(),
    /** 等级价快照（元） */
    priceAmount: z.union([z.string(), z.number()]).nullish(),
    /** 实付金额（元）；0 元单（免费等级）直接生效 */
    payAmount: z.union([z.string(), z.number()]).nullish(),
    /** 支付方式：balance / online / free */
    payMode: SysMemberLevelOrderPayModeSchema.nullish(),
    /** 状态：WP 待支付 / OD 已生效 / CL 已关闭 / FL 失败 */
    status: SysMemberLevelOrderStatusSchema.nullish(),
    /** 关联冻结单ID（sys_member_freeze.id），余额支付使用 */
    freezeId: z.string().nullish(),
    /** 关联支付单ID（sys_pay_order.id），在线支付使用 */
    payOrderId: z.string().nullish(),
    payChannelCode: z.string().nullish(),
    /** 本单产生的等级生效开始时间 YYYY-MM-DD HH:mm:ss */
    startAt: z.string().nullish(),
    /** 本单产生的等级生效结束时间 YYYY-MM-DD HH:mm:ss；null = 长期/不设期限 */
    endAt: z.string().nullish(),
    /** 支付成功时间 YYYY-MM-DD HH:mm:ss */
    paidAt: z.string().nullish(),
    /** 等级实际生效时间（写回 sys_member 的时刻）YYYY-MM-DD HH:mm:ss */
    effectiveAt: z.string().nullish(),
    /** 支付超时时间 YYYY-MM-DD HH:mm:ss（与 sys_member.expire_at 语义不同） */
    expireAt: z.string().nullish(),
    failReason: z.string().nullish(),
    remark: z.string().nullish(),
    createdBy: z.string().nullish(),
    /** 创建时间 YYYY-MM-DD HH:mm:ss */
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    /** 更新时间 YYYY-MM-DD HH:mm:ss */
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysMemberLevelOrderDto = z.infer<typeof SysMemberLevelOrderBaseSchema>
