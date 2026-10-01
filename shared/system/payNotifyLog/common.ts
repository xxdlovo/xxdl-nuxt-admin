import z from 'zod'

/**
 * 支付回调日志基础 Schema —— 与 sys_pay_notify_log 表结构保持一致。
 * 日志行由领域层（PayNotifyDispatcher / 主动查询）写入，管理端只读 + 清理。
 */
export const SysPayNotifyLogBaseSchema = z.object({
    id: z.string().nullish(),
    channelId: z.string().nullish(),
    channelCode: z.string().nullish(),
    orderId: z.string().nullish(),
    outTradeNo: z.string().nullish().meta({ query: 'like' }),
    providerOrderId: z.string().nullish().meta({ query: 'like' }),
    transactionId: z.string().nullish().meta({ query: 'like' }),
    amount: z.string().nullish(),
    currency: z.string().nullish(),
    providerStatus: z.string().nullish(),
    status: z.string().nullish(),
    /** 来源：notify 平台回调 / query 主动查询 / simulate 本地模拟 / reconcile 对账 */
    source: z.string().nullish(),
    dedupKey: z.string().nullish(),
    signValid: z.number().nullish(),
    /** 处理结论：success / duplicate / invalid_sign / order_not_found / amount_mismatch / status_mismatch / ip_blocked / error */
    processResult: z.string().nullish(),
    message: z.string().nullish().meta({ query: 'like' }),
    rawBody: z.string().nullish(),
    rawHeaders: z.unknown().nullish(),
    clientIp: z.string().nullish(),
    userAgent: z.string().nullish(),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysPayNotifyLogDto = z.infer<typeof SysPayNotifyLogBaseSchema>
