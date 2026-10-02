import { z } from 'zod'
import { SysMemberFreezeBaseSchema } from './common'
import { ApiRequestSchema } from '#shared/types/common'

/**
 * 新增冻结单。正常冻结由领域层（余额服务）在事务内写入，
 * 这里保留标准结构以便管理端补单 / 迁移，字段与表一一对应。
 */
export const SysMemberFreezeAddSchema =
    SysMemberFreezeBaseSchema.pick({
        bizNo: true,
        userId: true,
        amount: true,
        giftAmount: true,
        rechargeAmount: true,
        status: true,
        subject: true,
        attach: true,
        expireAt: true,
        remark: true,
    }).extend({
        id: SysMemberFreezeBaseSchema.shape.id.nonoptional(),
        bizNo: z.string().min(1, 'form.required').max(64, 'form.required'),
        userId: z.string().min(1, 'form.required').max(36, 'form.required'),
        amount: z.union([z.string(), z.number()]),
        giftAmount: z.union([z.string(), z.number()]).default('0.00'),
        rechargeAmount: z.union([z.string(), z.number()]).default('0.00'),
        status: z.string().max(20).default('FROZEN'),
        subject: z.string().max(200).nullish(),
        attach: z.string().max(255).nullish(),
        expireAt: z.string().max(19).nullish(),
        remark: z.string().max(255).nullish(),
    })
export type SysMemberFreezeAddDTO = z.infer<typeof SysMemberFreezeAddSchema>

// 修改：在新增基础上让 id 必填
export const SysMemberFreezeUpdateSchema = SysMemberFreezeAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysMemberFreezeUpdateDTO = z.infer<typeof SysMemberFreezeUpdateSchema>

/**
 * 释放冻结单：reason 必填（释放原因要留痕，写入 release_reason）。
 * 只有 FROZEN / EXPIRED 状态可释放，状态校验由 Service 负责。
 */
export const SysMemberFreezeReleaseSchema = z.object({
    id: z.string().nonempty('form.id.required'),
    reason: z.string().min(1, 'form.required').max(255, 'form.required'),
})
export type SysMemberFreezeReleaseDTO = z.infer<typeof SysMemberFreezeReleaseSchema>

/**
 * 查询条件。createdFrom / createdTo 不是表字段：
 * buildWhereBySchema 会自动跳过，由 Repo 的 pageWithRange 用区间条件消费。
 */
export const SysMemberFreezeQuerySchema = SysMemberFreezeBaseSchema.pick({
    id: true,
    bizNo: true,
    userId: true,
    status: true,
    subject: true,
}).extend({
    createdFrom: z.string().nullish(),
    createdTo: z.string().nullish(),
})
export type SysMemberFreezeQueryDTO = z.infer<typeof SysMemberFreezeQuerySchema>

// 分页查询：查询条件 + 分页参数
export const SysMemberFreezePageQuerySchema =
    SysMemberFreezeQuerySchema.extend(ApiRequestSchema.shape)
export type SysMemberFreezePageQueryDTO = z.infer<typeof SysMemberFreezePageQuerySchema>
