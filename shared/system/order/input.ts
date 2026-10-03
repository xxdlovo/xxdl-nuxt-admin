import { z } from 'zod'
import { SysOrderBaseSchema } from './common'
import { ApiRequestSchema } from '#shared/types/common'

/** 资金状态：待支付 / 已完成 / 已关闭 / 发起失败 */
export const SysOrderStatusSchema = z.enum(['WP', 'OD', 'CL', 'FL'])
/** 支付方式：余额支付 / 在线支付 */
export const SysOrderPayModeSchema = z.enum(['balance', 'online'])
/** 履约状态：无需交付 / 待交付 / 已交付 */
export const SysOrderFulfillStatusSchema = z.enum(['none', 'pending', 'delivered'])

// 后台查询条件：表字段交给 CommonRepo，区间类非表字段由 Repo 消费
export const SysOrderQuerySchema = SysOrderBaseSchema.pick({
    id: true,
    orderNo: true,
    userId: true,
    goodsId: true,
    status: true,
    payMode: true,
    fulfillStatus: true,
    priceSource: true,
    couponCode: true,
}).extend({
    /** 应付金额区间（非表字段，搜索框传字符串） */
    amountMin: z.string().max(20).nullish(),
    amountMax: z.string().max(20).nullish(),
    /** 下单时间区间 YYYY-MM-DD HH:mm:ss（非表字段） */
    createdFrom: z.string().max(30).nullish(),
    createdTo: z.string().max(30).nullish(),
})
export type SysOrderQueryDTO = z.infer<typeof SysOrderQuerySchema>

// 分页查询：查询条件 + 分页参数
export const SysOrderPageQuerySchema = SysOrderQuerySchema.extend(ApiRequestSchema.shape)
export type SysOrderPageQueryDTO = z.infer<typeof SysOrderPageQuerySchema>

/** 后台修改：订单只允许改备注（金额与状态由业务动作驱动） */
export const SysOrderUpdateSchema = z.object({
    id: z.string().nonempty('form.id.required'),
    remark: z.string().max(255).nullish(),
})
export type SysOrderUpdateDTO = z.infer<typeof SysOrderUpdateSchema>

/**
 * 会员自助下单。
 * `requestId` 是幂等键：前端每次提交生成，重复提交（连点/重试）只会落一单。
 * 服务类商品 quantity 固定 1、contact 必填（服务端按商品类型校验）。
 */
export const SysOrderCreateSchema = z.object({
    goodsId: z.string().min(1, 'form.required').max(36, 'form.required'),
    quantity: z.number().int().min(1, 'form.required').max(99).default(1),
    couponCode: z.string().max(32).nullish(),
    payMode: SysOrderPayModeSchema.default('balance'),
    /** 服务类联系方式（如应用迁移的对接人电话/邮箱） */
    contact: z.string().max(50).nullish(),
    /** 需求说明 */
    remark: z.string().max(255).nullish(),
    requestId: z.string().min(1, 'form.required').max(64, 'form.required'),
})
export type SysOrderCreateDTO = z.infer<typeof SysOrderCreateSchema>

/** 按订单号操作（会员自助：详情 / 确认 / 取消 / 同步） */
export const SysOrderNoSchema = z.object({
    orderNo: z.string().min(1, 'form.required').max(64, 'form.required'),
})
export type SysOrderNoDTO = z.infer<typeof SysOrderNoSchema>

/** 后台确认支付（余额单实扣） */
export const SysOrderConfirmSchema = z.object({
    id: z.string().nonempty('form.id.required'),
})
export type SysOrderConfirmDTO = z.infer<typeof SysOrderConfirmSchema>

/** 后台关闭订单：释放冻结、释放优惠码、回滚库存 */
export const SysOrderCloseSchema = z.object({
    id: z.string().nonempty('form.id.required'),
    reason: z.string().max(255).nullish(),
})
export type SysOrderCloseDTO = z.infer<typeof SysOrderCloseSchema>

/** 后台服务交付 */
export const SysOrderFulfillSchema = z.object({
    id: z.string().nonempty('form.id.required'),
    remark: z.string().max(255).nullish(),
})
export type SysOrderFulfillDTO = z.infer<typeof SysOrderFulfillSchema>

/** 后台按 id 同步支付状态 */
export const SysOrderSyncSchema = z.object({
    id: z.string().nonempty('form.id.required'),
})
export type SysOrderSyncDTO = z.infer<typeof SysOrderSyncSchema>

/** 订单统计（看板卡片）：不传区间表示全部，传了按创建时间过滤 */
export const SysOrderSummarySchema = z.object({
    createdFrom: z.string().max(30).nullish(),
    createdTo: z.string().max(30).nullish(),
})
export type SysOrderSummaryDTO = z.infer<typeof SysOrderSummarySchema>

/** 我的订单查询（会员自助，只查自己的单） */
export const SysOrderMyQuerySchema = z.object({
    status: SysOrderStatusSchema.nullish(),
    fulfillStatus: SysOrderFulfillStatusSchema.nullish(),
}).extend(ApiRequestSchema.shape)
export type SysOrderMyQueryDTO = z.infer<typeof SysOrderMyQuerySchema>
