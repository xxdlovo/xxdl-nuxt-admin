import { z } from 'zod'
import { SysPayOrderBaseSchema, SysPayOrderStatusSchema } from './common'
import { ApiRequestSchema } from '#shared/types/common'

/**
 * 新增：管理端手工补录（正常下单走 sysPayTest.createScanPay / PayOrderService.createPayment，
 * 不会经过这里）。入库金额统一两位小数。
 */
export const SysPayOrderAddSchema =
    SysPayOrderBaseSchema.pick({
        outTradeNo: true,
        channelId: true,
        channelCode: true,
        providerOrderId: true,
        transactionId: true,
        bizType: true,
        subject: true,
        amount: true,
        currency: true,
        status: true,
        providerStatus: true,
        payMode: true,
        attach: true,
        remark: true,
    }).extend({
        id: SysPayOrderBaseSchema.shape.id.nonoptional(),
        outTradeNo: z.string().min(1, 'form.required').max(64, 'form.required'),
        channelCode: z.string().min(1, 'form.required').max(30, 'form.required'),
        subject: z.string().min(1, 'form.required').max(200, 'form.required'),
        amount: z.string().min(1, 'form.required').max(20, 'form.required'),
        currency: z.string().min(1, 'form.required').max(10).default('CNY'),
        status: SysPayOrderStatusSchema.default('WP'),
        bizType: z.string().max(50).default('test'),
        payMode: z.string().max(20).default('qrcode'),
    })
export type SysPayOrderAddDTO = z.infer<typeof SysPayOrderAddSchema>

// 修改
export const SysPayOrderUpdateSchema = SysPayOrderAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysPayOrderUpdateDTO = z.infer<typeof SysPayOrderUpdateSchema>

/**
 * 查询条件。
 * amountMin / amountMax / createdFrom / createdTo 不是表字段：
 * buildWhereBySchema 会自动跳过，改由 SysPayOrderRepo.pageWithRange 用区间条件消费。
 */
export const SysPayOrderQuerySchema = SysPayOrderBaseSchema.pick({
    id: true,
    outTradeNo: true,
    channelId: true,
    channelCode: true,
    providerOrderId: true,
    transactionId: true,
    bizType: true,
    subject: true,
    status: true,
    currency: true,
    remark: true,
}).extend({
    amountMin: z.string().nullish(),
    amountMax: z.string().nullish(),
    createdFrom: z.string().nullish(),
    createdTo: z.string().nullish(),
})
export type SysPayOrderQueryDTO = z.infer<typeof SysPayOrderQuerySchema>

// 分页查询：查询条件 + 分页参数
export const SysPayOrderPageQuerySchema =
    SysPayOrderQuerySchema.extend(ApiRequestSchema.shape)
export type SysPayOrderPageQueryDTO = z.infer<typeof SysPayOrderPageQuerySchema>
