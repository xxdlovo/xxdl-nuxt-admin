import { z } from 'zod'
import { SysPayNotifyLogBaseSchema } from './common'

/** 回调日志响应：列表与详情共用 */
export const SysPayNotifyLogRespSchema = z.object({
    id: SysPayNotifyLogBaseSchema.shape.id,
    channelId: SysPayNotifyLogBaseSchema.shape.channelId,
    channelCode: SysPayNotifyLogBaseSchema.shape.channelCode,
    orderId: SysPayNotifyLogBaseSchema.shape.orderId,
    outTradeNo: SysPayNotifyLogBaseSchema.shape.outTradeNo,
    providerOrderId: SysPayNotifyLogBaseSchema.shape.providerOrderId,
    transactionId: SysPayNotifyLogBaseSchema.shape.transactionId,
    amount: SysPayNotifyLogBaseSchema.shape.amount,
    currency: SysPayNotifyLogBaseSchema.shape.currency,
    providerStatus: SysPayNotifyLogBaseSchema.shape.providerStatus,
    status: SysPayNotifyLogBaseSchema.shape.status,
    source: SysPayNotifyLogBaseSchema.shape.source,
    dedupKey: SysPayNotifyLogBaseSchema.shape.dedupKey,
    signValid: SysPayNotifyLogBaseSchema.shape.signValid,
    processResult: SysPayNotifyLogBaseSchema.shape.processResult,
    message: SysPayNotifyLogBaseSchema.shape.message,
    rawBody: SysPayNotifyLogBaseSchema.shape.rawBody,
    rawHeaders: SysPayNotifyLogBaseSchema.shape.rawHeaders,
    clientIp: SysPayNotifyLogBaseSchema.shape.clientIp,
    userAgent: SysPayNotifyLogBaseSchema.shape.userAgent,
    createdAt: SysPayNotifyLogBaseSchema.shape.createdAt,
    updatedAt: SysPayNotifyLogBaseSchema.shape.updatedAt,
})
export type SysPayNotifyLogRespDTO = z.infer<typeof SysPayNotifyLogRespSchema>
