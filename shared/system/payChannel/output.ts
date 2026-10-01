import { z } from 'zod'
import { SysPayChannelBaseSchema } from './common'

/**
 * 渠道配置响应：config 中的密钥字段已由 Service 掩码，
 * 因此这里不再暴露密文信封结构。
 */
export const SysPayChannelRespSchema = z.object({
    id: SysPayChannelBaseSchema.shape.id,
    configKey: SysPayChannelBaseSchema.shape.configKey,
    configName: SysPayChannelBaseSchema.shape.configName,
    channelCode: SysPayChannelBaseSchema.shape.channelCode,
    mode: SysPayChannelBaseSchema.shape.mode,
    currency: SysPayChannelBaseSchema.shape.currency,
    config: SysPayChannelBaseSchema.shape.config,
    notifyUrl: SysPayChannelBaseSchema.shape.notifyUrl,
    returnUrl: SysPayChannelBaseSchema.shape.returnUrl,
    cancelUrl: SysPayChannelBaseSchema.shape.cancelUrl,
    orderTimeoutMinutes: SysPayChannelBaseSchema.shape.orderTimeoutMinutes,
    isDefault: SysPayChannelBaseSchema.shape.isDefault,
    verifyStatus: SysPayChannelBaseSchema.shape.verifyStatus,
    verifyTime: SysPayChannelBaseSchema.shape.verifyTime,
    verifyMessage: SysPayChannelBaseSchema.shape.verifyMessage,
    status: SysPayChannelBaseSchema.shape.status,
    sortOrder: SysPayChannelBaseSchema.shape.sortOrder,
    ipAllowlist: SysPayChannelBaseSchema.shape.ipAllowlist,
    remark: SysPayChannelBaseSchema.shape.remark,
    createdAt: SysPayChannelBaseSchema.shape.createdAt,
    updatedAt: SysPayChannelBaseSchema.shape.updatedAt,
})
export type SysPayChannelRespDTO = z.infer<typeof SysPayChannelRespSchema>

/** 渠道能力位：前端据此决定展示二维码图片还是二维码内容、是否提供「测试配置」等 */
export const SysPayProviderCapabilitiesSchema = z.object({
    qrcode: z.boolean(),
    redirect: z.boolean(),
    jsapi: z.boolean(),
    refund: z.boolean(),
    query: z.boolean(),
    sandbox: z.boolean(),
    localQrRender: z.boolean(),
})

/** 渠道私有配置字段元数据：驱动前端动态表单 */
export const SysPayProviderFieldSchema = z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['text', 'password', 'number', 'switch', 'textarea']),
    required: z.boolean().optional(),
    secret: z.boolean().optional(),
    placeholder: z.string().optional(),
    help: z.string().optional(),
    defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
})
export type SysPayProviderFieldDTO = z.infer<typeof SysPayProviderFieldSchema>

export const SysPayProviderMetaSchema = z.object({
    code: z.string(),
    name: z.string(),
    capabilities: SysPayProviderCapabilitiesSchema,
    fields: z.array(SysPayProviderFieldSchema),
})
export type SysPayProviderMetaDTO = z.infer<typeof SysPayProviderMetaSchema>

/** 「测试配置」结果 */
export const SysPayVerifyResultSchema = z.object({
    success: z.boolean(),
    message: z.string(),
})
export type SysPayVerifyResultDTO = z.infer<typeof SysPayVerifyResultSchema>

/**
 * 渠道类型元数据列表：驱动前端的渠道类型下拉与动态表单。
 * encryptionReady 表示服务端是否已配置可用的 NUXT_PAY_CONFIG_KEY；
 * encryptionReason 区分「没配置」与「格式不对」，便于界面给出准确提示。
 */
export const SysPayProviderMetasSchema = z.object({
    providers: z.array(SysPayProviderMetaSchema),
    encryptionReady: z.boolean(),
    encryptionReason: z.enum(['ok', 'missing', 'invalid']),
})
export type SysPayProviderMetasDTO = z.infer<typeof SysPayProviderMetasSchema>
