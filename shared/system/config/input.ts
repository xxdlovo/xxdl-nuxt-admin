import { z } from 'zod'
import { ApiRequestSchema } from '#shared/types/common'
import { SysConfigBaseSchema } from './common'

export const SysConfigAddSchema = SysConfigBaseSchema.pick({
  configName: true,
  configKey: true,
  configValue: true,
  configType: true,
  status: true,
  remark: true
}).extend({
  id: SysConfigBaseSchema.shape.id.nonoptional(),
  configKey: z.string().min(1, 'form.required').max(255, 'form.required'),
  configValue: z.string().min(1, 'form.required').max(255, 'form.required'),
  configName: z.string().max(36, 'form.required').optional(),
  configType: z.number().default(1),
  status: z.number().default(1),
  remark: z.string().max(255, 'form.required').optional()
})

export type SysConfigAddDTO = z.infer<typeof SysConfigAddSchema>

export const SysConfigUpdateSchema = SysConfigAddSchema.extend({
  id: z.string().nonempty('form.id.required')
})

export type SysConfigUpdateDTO = z.infer<typeof SysConfigUpdateSchema>

export const SysConfigQuerySchema = SysConfigBaseSchema.pick({
  id: true,
  configName: true,
  configKey: true,
  configValue: true,
  configType: true,
  status: true,
  remark: true
})

export type SysConfigQueryDTO = z.infer<typeof SysConfigQuerySchema>

export const SysConfigPageQuerySchema = SysConfigQuerySchema.extend(ApiRequestSchema.shape)

export type SysConfigPageQueryDTO = z.infer<typeof SysConfigPageQuerySchema>
