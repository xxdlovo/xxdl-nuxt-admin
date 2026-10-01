import z from 'zod'

/**
 * 支付订单基础 Schema —— 与 sys_pay_order 表结构保持一致。
 * amount 在 MySQL 中是 decimal(10,2)，drizzle 读写均为字符串。
 */
export const SysPayOrderBaseSchema = z.object({
    id: z.string().nullish(),
    outTradeNo: z.string().nullish().meta({ query: 'like' }),
    channelId: z.string().nullish(),
    channelCode: z.string().nullish(),
    providerOrderId: z.string().nullish().meta({ query: 'like' }),
    transactionId: z.string().nullish().meta({ query: 'like' }),
    bizType: z.string().nullish(),
    subject: z.string().nullish().meta({ query: 'like' }),
    amount: z.string().nullish(),
    currency: z.string().nullish(),
    /** 统一状态：WP 待支付 / OD 已支付 / CD 已取消 / CL 已关闭 / FL 发起失败 / RF 已退款 */
    status: z.string().nullish(),
    providerStatus: z.string().nullish(),
    payMode: z.string().nullish(),
    qrImageUrl: z.string().nullish(),
    qrContent: z.string().nullish(),
    payUrl: z.string().nullish(),
    notifyUrl: z.string().nullish(),
    attach: z.string().nullish().meta({ query: 'like' }),
    clientIp: z.string().nullish(),
    userAgent: z.string().nullish(),
    expireAt: z.string().nullish(),
    paidAt: z.string().nullish(),
    cancelledAt: z.string().nullish(),
    lastQueryAt: z.string().nullish(),
    notifyCount: z.number().nullish(),
    lastNotifyAt: z.string().nullish(),
    failReason: z.string().nullish(),
    providerData: z.unknown().nullish(),
    remark: z.string().nullish().meta({ query: 'like' }),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysPayOrderDto = z.infer<typeof SysPayOrderBaseSchema>

/** 统一支付状态枚举 */
export const SysPayOrderStatusSchema = z.enum(['WP', 'OD', 'CD', 'CL', 'FL', 'RF'])
export type SysPayOrderStatusDTO = z.infer<typeof SysPayOrderStatusSchema>
