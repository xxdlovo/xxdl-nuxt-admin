import z from 'zod'

/**
 * 支付渠道配置基础 Schema —— 与 sys_pay_channel 表结构保持一致。
 * 所有字段统一 nullish()，便于 pick() / extend() 复用；必填规则在 input.ts 覆盖。
 */
export const SysPayChannelBaseSchema = z.object({
    id: z.string().nullish(),
    configKey: z.string().nullish().meta({ query: 'like' }),
    configName: z.string().nullish().meta({ query: 'like' }),
    channelCode: z.string().nullish().meta({ query: 'like' }),
    mode: z.string().nullish(),
    currency: z.string().nullish(),
    /** 渠道私有配置；密钥字段为 AES-256-GCM 密文信封 */
    config: z.record(z.string(), z.unknown()).nullish(),
    notifyUrl: z.string().nullish().meta({ query: 'like' }),
    returnUrl: z.string().nullish(),
    cancelUrl: z.string().nullish(),
    orderTimeoutMinutes: z.number().nullish(),
    isDefault: z.number().nullish(),
    verifyStatus: z.number().nullish(),
    verifyTime: z.string().nullish(),
    verifyMessage: z.string().nullish(),
    status: z.number().nullish(),
    sortOrder: z.number().nullish(),
    ipAllowlist: z.string().nullish(),
    remark: z.string().nullish().meta({ query: 'like' }),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysPayChannelDto = z.infer<typeof SysPayChannelBaseSchema>
