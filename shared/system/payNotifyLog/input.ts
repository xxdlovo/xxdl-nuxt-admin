import { z } from 'zod'
import { SysPayNotifyLogBaseSchema } from './common'
import { ApiRequestSchema } from '#shared/types/common'

/**
 * 新增：正常链路里日志由领域层写入；这里保留标准 CRUD（与 sysLoginLog 等日志模块一致），
 * 便于特殊场景人工补录。
 */
export const SysPayNotifyLogAddSchema =
    SysPayNotifyLogBaseSchema.pick({
        channelId: true,
        channelCode: true,
        orderId: true,
        outTradeNo: true,
        providerOrderId: true,
        transactionId: true,
        amount: true,
        currency: true,
        providerStatus: true,
        status: true,
        source: true,
        dedupKey: true,
        signValid: true,
        processResult: true,
        message: true,
        rawBody: true,
        clientIp: true,
        userAgent: true,
    }).extend({
        id: SysPayNotifyLogBaseSchema.shape.id.nonoptional(),
        channelCode: z.string().min(1, 'form.required').max(30, 'form.required'),
        outTradeNo: z.string().min(1, 'form.required').max(64, 'form.required'),
        processResult: z.string().min(1, 'form.required').max(20, 'form.required'),
        source: z.enum(['notify', 'query', 'simulate', 'reconcile']).default('notify'),
        signValid: z.number().default(1),
    })
export type SysPayNotifyLogAddDTO = z.infer<typeof SysPayNotifyLogAddSchema>

// 修改
export const SysPayNotifyLogUpdateSchema = SysPayNotifyLogAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysPayNotifyLogUpdateDTO = z.infer<typeof SysPayNotifyLogUpdateSchema>

/**
 * 查询条件。createdFrom / createdTo 不是表字段：
 * buildWhereBySchema 会自动跳过，由 SysPayNotifyLogRepo.pageWithRange 用区间条件消费。
 */
export const SysPayNotifyLogQuerySchema = SysPayNotifyLogBaseSchema.pick({
    id: true,
    channelId: true,
    channelCode: true,
    orderId: true,
    outTradeNo: true,
    providerOrderId: true,
    transactionId: true,
    status: true,
    source: true,
    processResult: true,
    currency: true,
    clientIp: true,
    message: true,
}).extend({
    createdFrom: z.string().nullish(),
    createdTo: z.string().nullish(),
})
export type SysPayNotifyLogQueryDTO = z.infer<typeof SysPayNotifyLogQuerySchema>

// 分页查询：查询条件 + 分页参数
export const SysPayNotifyLogPageQuerySchema =
    SysPayNotifyLogQuerySchema.extend(ApiRequestSchema.shape)
export type SysPayNotifyLogPageQueryDTO = z.infer<typeof SysPayNotifyLogPageQuerySchema>
