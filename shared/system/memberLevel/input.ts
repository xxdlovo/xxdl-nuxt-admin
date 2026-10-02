import { z } from 'zod'
import { SysMemberLevelBaseSchema } from './common'
import { ApiRequestSchema } from '#shared/types/common'

// 新增
export const SysMemberLevelAddSchema = SysMemberLevelBaseSchema.pick({
    code: true,
    name: true,
    sortOrder: true,
    benefit: true,
    status: true,
    remark: true,
}).extend({
    id: SysMemberLevelBaseSchema.shape.id.nonoptional(),
    code: z.string().min(1, 'form.required').max(50, 'form.required'),
    name: z.string().min(1, 'form.required').max(50, 'form.required'),
    sortOrder: z.number().int().default(0),
    /** 等级权益说明，展示用文本 */
    benefit: z.string().max(500).nullish(),
    status: z.number().default(1),
    remark: z.string().max(255).nullish(),
})
export type SysMemberLevelAddDTO = z.infer<typeof SysMemberLevelAddSchema>

// 修改：在新增基础上让 id 必填
export const SysMemberLevelUpdateSchema = SysMemberLevelAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysMemberLevelUpdateDTO = z.infer<typeof SysMemberLevelUpdateSchema>

// 查询条件
export const SysMemberLevelQuerySchema = SysMemberLevelBaseSchema.pick({
    id: true,
    code: true,
    name: true,
    sortOrder: true,
    benefit: true,
    status: true,
    remark: true,
})
export type SysMemberLevelQueryDTO = z.infer<typeof SysMemberLevelQuerySchema>

// 分页查询：查询条件 + 分页参数
export const SysMemberLevelPageQuerySchema =
    SysMemberLevelQuerySchema.extend(ApiRequestSchema.shape)
export type SysMemberLevelPageQueryDTO = z.infer<typeof SysMemberLevelPageQuerySchema>
