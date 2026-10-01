import { z } from 'zod'

/**
 * 测试页订单快照：供二维码展示、状态轮询与「模拟支付成功」按钮使用。
 * simulateEnabled 由服务端按环境变量判定，前端不自行猜测。
 */
export const SysPayTestStatusSchema = z.object({
    id: z.string(),
    outTradeNo: z.string(),
    channelId: z.string().nullish(),
    channelCode: z.string(),
    channelName: z.string().nullish(),
    subject: z.string(),
    amount: z.string(),
    currency: z.string(),
    status: z.string(),
    providerStatus: z.string().nullish(),
    payMode: z.string(),
    qrImageUrl: z.string().nullish(),
    qrContent: z.string().nullish(),
    payUrl: z.string().nullish(),
    notifyUrl: z.string().nullish(),
    expireAt: z.string().nullish(),
    paidAt: z.string().nullish(),
    notifyCount: z.number().nullish(),
    createdAt: z.string().nullish(),
    /** 服务端是否允许本地模拟回调 */
    simulateEnabled: z.boolean(),
    /** 当前渠道适配器是否实现了模拟回调 */
    simulateSupported: z.boolean(),
})
export type SysPayTestStatusDTO = z.infer<typeof SysPayTestStatusSchema>

/** 模拟回调 / 主动查询的结果提示 */
export const SysPayTestActionResultSchema = z.object({
    processResult: z.string().optional(),
    orderId: z.string().nullish(),
    message: z.string().optional(),
})
export type SysPayTestActionResultDTO = z.infer<typeof SysPayTestActionResultSchema>
