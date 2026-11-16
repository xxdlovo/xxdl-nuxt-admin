import { z } from 'zod'
import { SysPostBaseSchema } from './common'
import { ApiRequestSchema } from '#admin/shared/types/common'

export const SysPostAddSchema = SysPostBaseSchema.pick({
    code: true,
    name: true,
    sortOrder: true,
    status: true,
    remark: true,
}).extend({
    id: SysPostBaseSchema.shape.id.nonoptional(),
    code: z.string().min(1, 'form.required').max(50, 'form.required'),
    name: z.string().min(1, 'form.required').max(50, 'form.required'),
})

export type SysPostAddDTO = z.infer<typeof SysPostAddSchema>

export const SysPostUpdateSchema = SysPostAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})

export type SysPostUpdateDTO = z.infer<typeof SysPostUpdateSchema>

export const SysPostQuerySchema = SysPostBaseSchema.pick({
    id: true,
    code: true,
    name: true,
    status: true,
    remark: true,
})

export type SysPostQueryDTO = z.infer<typeof SysPostQuerySchema>

export const SysPostPageQuerySchema = SysPostQuerySchema.extend(ApiRequestSchema.shape)
export type SysPostPageQueryDTO = z.infer<typeof SysPostPageQuerySchema>
