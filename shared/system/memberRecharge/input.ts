import { z } from 'zod'
import { SysMemberRechargeBaseSchema } from './common'
import { ApiRequestSchema } from '#shared/types/common'

/**
 * 新增：管理端手工补录充值单。
 * 正常充值走 SysMemberRechargeCreateSchema（自助发起）→ 支付渠道 → 回调入账，
 * 不会经过这里；补录用于线下转账等场景，状态由管理端指定。
 */
export const SysMemberRechargeAddSchema =
    SysMemberRechargeBaseSchema.pick({
        outTradeNo: true,
        userId: true,
        amount: true,
        giftAmount: true,
        discountAmount: true,
        payAmount: true,
        couponId: true,
        couponCode: true,
        status: true,
        payChannelCode: true,
        paidAt: true,
        creditedAt: true,
        expireAt: true,
        failReason: true,
        remark: true,
    }).extend({
        id: SysMemberRechargeBaseSchema.shape.id.nonoptional(),
        outTradeNo: z.string().min(1, 'form.required').max(64, 'form.required'),
        userId: z.string().min(1, 'form.required').max(36, 'form.required'),
        amount: z.union([z.string(), z.number()]),
        giftAmount: z.union([z.string(), z.number()]).default('0.00'),
        discountAmount: z.union([z.string(), z.number()]).default('0.00'),
        payAmount: z.union([z.string(), z.number()]),
        couponId: z.string().max(36).nullish(),
        couponCode: z.string().max(32).nullish(),
        status: z.string().max(10).default('WP'),
        payChannelCode: z.string().max(30).nullish(),
        paidAt: z.string().max(19).nullish(),
        creditedAt: z.string().max(19).nullish(),
        expireAt: z.string().max(19).nullish(),
        failReason: z.string().max(500).nullish(),
        remark: z.string().max(255).nullish(),
    })
export type SysMemberRechargeAddDTO = z.infer<typeof SysMemberRechargeAddSchema>

/**
 * 修改：在新增基础上让 id 必填。
 * status / paidAt / creditedAt 仍保留在入参里，便于管理端纠正异常单；
 * 正常链路的状态流转由回调写入，不经过本 Schema。
 */
export const SysMemberRechargeUpdateSchema = SysMemberRechargeAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysMemberRechargeUpdateDTO = z.infer<typeof SysMemberRechargeUpdateSchema>

/**
 * 自助发起充值：金额必填，优惠码与回调地址可选。
 * 订单号、渠道、过期时间由 Service 生成；notifyUrl 留空时用渠道配置再退化为请求 origin。
 */
export const SysMemberRechargeCreateSchema = z.object({
    amount: z.union([z.string(), z.number()]),
    couponCode: z.string().max(32).nullish(),
    notifyUrl: z.string().max(500).nullish(),
})
export type SysMemberRechargeCreateDTO = z.infer<typeof SysMemberRechargeCreateSchema>

/** 关闭充值单：未支付/发起失败的单据置为 CD，reason 写入备注 */
export const SysMemberRechargeCloseSchema = z.object({
    id: z.string().nonempty('form.id.required'),
    reason: z.string().max(500).nullish(),
})
export type SysMemberRechargeCloseDTO = z.infer<typeof SysMemberRechargeCloseSchema>

/**
 * 查询条件。amountMin / amountMax / createdFrom / createdTo 不是表字段：
 * buildWhereBySchema 会自动跳过，改由 Repo 的 pageWithRange 用区间条件消费。
 */
export const SysMemberRechargeQuerySchema = SysMemberRechargeBaseSchema.pick({
    id: true,
    outTradeNo: true,
    userId: true,
    couponId: true,
    couponCode: true,
    status: true,
    payOrderId: true,
    payChannelCode: true,
}).extend({
    amountMin: z.string().nullish(),
    amountMax: z.string().nullish(),
    createdFrom: z.string().nullish(),
    createdTo: z.string().nullish(),
})
export type SysMemberRechargeQueryDTO = z.infer<typeof SysMemberRechargeQuerySchema>

// 分页查询：查询条件 + 分页参数
export const SysMemberRechargePageQuerySchema =
    SysMemberRechargeQuerySchema.extend(ApiRequestSchema.shape)
export type SysMemberRechargePageQueryDTO = z.infer<typeof SysMemberRechargePageQuerySchema>
