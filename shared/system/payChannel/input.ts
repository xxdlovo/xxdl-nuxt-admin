import { z } from 'zod'
import { SysPayChannelBaseSchema } from './common'
import { ApiRequestSchema } from '#shared/types/common'

/** 渠道私有配置：具体字段由 PayProvider.configSchema 在 Service 层二次校验 */
export const SysPayChannelConfigSchema = z.record(z.string(), z.unknown())

// 新增
export const SysPayChannelAddSchema =
    SysPayChannelBaseSchema.pick({
        configKey: true,
        configName: true,
        channelCode: true,
        mode: true,
        currency: true,
        config: true,
        notifyUrl: true,
        returnUrl: true,
        cancelUrl: true,
        orderTimeoutMinutes: true,
        isDefault: true,
        status: true,
        sortOrder: true,
        ipAllowlist: true,
        remark: true,
    }).extend({
        id: SysPayChannelBaseSchema.shape.id.nonoptional(),
        configKey: z.string().min(1, 'form.required').max(50, 'form.required'),
        configName: z.string().min(1, 'form.required').max(50, 'form.required'),
        channelCode: z.string().min(1, 'form.required').max(30, 'form.required'),
        mode: z.enum(['live', 'test']).default('live'),
        currency: z.string().min(1, 'form.required').max(10).default('CNY'),
        config: SysPayChannelConfigSchema.optional(),
        notifyUrl: z.string().max(500).nullish(),
        orderTimeoutMinutes: z.number().int().min(1).max(1440).default(30),
        isDefault: z.number().default(0),
        status: z.number().default(1),
    })
export type SysPayChannelAddDTO = z.infer<typeof SysPayChannelAddSchema>

// 修改：在新增基础上让 id 必填
export const SysPayChannelUpdateSchema = SysPayChannelAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysPayChannelUpdateDTO = z.infer<typeof SysPayChannelUpdateSchema>

// 查询条件
export const SysPayChannelQuerySchema = SysPayChannelBaseSchema.pick({
    id: true,
    configKey: true,
    configName: true,
    channelCode: true,
    mode: true,
    currency: true,
    isDefault: true,
    verifyStatus: true,
    status: true,
    remark: true,
})
export type SysPayChannelQueryDTO = z.infer<typeof SysPayChannelQuerySchema>

// 分页查询：查询条件 + 分页参数
export const SysPayChannelPageQuerySchema =
    SysPayChannelQuerySchema.extend(ApiRequestSchema.shape)
export type SysPayChannelPageQueryDTO = z.infer<typeof SysPayChannelPageQuerySchema>
