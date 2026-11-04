import { z } from 'zod'
import { SysPayOrderBaseSchema } from './common'

/** 支付订单响应：与列表 / 详情页展示字段一一对应 */
export const SysPayOrderRespSchema = z.object({
    id: SysPayOrderBaseSchema.shape.id,
    outTradeNo: SysPayOrderBaseSchema.shape.outTradeNo,
    channelId: SysPayOrderBaseSchema.shape.channelId,
    channelCode: SysPayOrderBaseSchema.shape.channelCode,
    providerOrderId: SysPayOrderBaseSchema.shape.providerOrderId,
    transactionId: SysPayOrderBaseSchema.shape.transactionId,
    bizType: SysPayOrderBaseSchema.shape.bizType,
    subject: SysPayOrderBaseSchema.shape.subject,
    amount: SysPayOrderBaseSchema.shape.amount,
    currency: SysPayOrderBaseSchema.shape.currency,
    status: SysPayOrderBaseSchema.shape.status,
    providerStatus: SysPayOrderBaseSchema.shape.providerStatus,
    payMode: SysPayOrderBaseSchema.shape.payMode,
    qrImageUrl: SysPayOrderBaseSchema.shape.qrImageUrl,
    qrContent: SysPayOrderBaseSchema.shape.qrContent,
    payUrl: SysPayOrderBaseSchema.shape.payUrl,
    notifyUrl: SysPayOrderBaseSchema.shape.notifyUrl,
    attach: SysPayOrderBaseSchema.shape.attach,
    clientIp: SysPayOrderBaseSchema.shape.clientIp,
    userAgent: SysPayOrderBaseSchema.shape.userAgent,
    expireAt: SysPayOrderBaseSchema.shape.expireAt,
    paidAt: SysPayOrderBaseSchema.shape.paidAt,
    cancelledAt: SysPayOrderBaseSchema.shape.cancelledAt,
    lastQueryAt: SysPayOrderBaseSchema.shape.lastQueryAt,
    notifyCount: SysPayOrderBaseSchema.shape.notifyCount,
    lastNotifyAt: SysPayOrderBaseSchema.shape.lastNotifyAt,
    failReason: SysPayOrderBaseSchema.shape.failReason,
    providerData: SysPayOrderBaseSchema.shape.providerData,
    remark: SysPayOrderBaseSchema.shape.remark,
    createdAt: SysPayOrderBaseSchema.shape.createdAt,
    updatedAt: SysPayOrderBaseSchema.shape.updatedAt,
})
export type SysPayOrderRespDTO = z.infer<typeof SysPayOrderRespSchema>
