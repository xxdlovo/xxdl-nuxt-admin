import { z } from 'zod'

/**
 * 扫码支付测试页入参。
 * 不指定渠道时使用库中的默认启用渠道（is_default 优先，其次 sortOrder）。
 */
export const SysPayTestCreateSchema = z.object({
    channelId: z.string().max(36).nullish(),
    channelCode: z.string().max(30).nullish(),
    /** 指定商户订单号；留空由后端生成（PAY + 时间戳 + 随机码） */
    outTradeNo: z.string().max(64).nullish(),
    amount: z.union([z.string(), z.number()]),
    subject: z.string().min(1, 'form.required').max(200, 'form.required'),
    attach: z.string().max(255).nullish(),
    remark: z.string().max(255).nullish(),
    /** 留空时用渠道配置的 notify_url，再退化为按请求 origin 推导 */
    notifyUrl: z.string().max(500).nullish(),
    bizType: z.string().max(50).nullish(),
})
export type SysPayTestCreateDTO = z.infer<typeof SysPayTestCreateSchema>

/** 按订单 id 查询 / 同步状态 */
export const SysPayTestOrderSchema = z.object({
    id: z.string().nonempty('form.id.required'),
})
export type SysPayTestOrderDTO = z.infer<typeof SysPayTestOrderSchema>
