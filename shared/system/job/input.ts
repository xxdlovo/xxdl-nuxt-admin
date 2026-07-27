import { SysJobBaseSchema } from './common'
import { z } from 'zod'
import { ApiRequestSchema } from '#shared/types/common'

export const SysJobAddSchema =
  SysJobBaseSchema.pick({
    jobName: true,
    jobCode: true,
    handlerCode: true,
    cronExpression: true,
    cronTimezone: true,
    status: true,
    sortOrder: true,
    remark: true,
  }).extend({
    id: SysJobBaseSchema.shape.id.nonoptional(),
    jobName: z.string().min(1, 'form.required'),
    jobCode: z.string().min(1, 'form.required'),
    handlerCode: z.string().min(1, 'form.required'),
    cronExpression: z.string().min(1, 'form.required'),
    cronTimezone: z.string().default('Asia/Shanghai'),
    status: z.number().default(1),
    sortOrder: z.number().default(0),
  })
export type SysJobAddDTO = z.infer<typeof SysJobAddSchema>

export const SysJobUpdateSchema = SysJobAddSchema.extend({
  id: z.string().nonempty('form.id.required'),
})
export type SysJobUpdateDTO = z.infer<typeof SysJobUpdateSchema>

export const SysJobStatusSchema = z.object({
  id: z.string().nonempty('form.id.required')
})
export type SysJobStatusDTO = z.infer<typeof SysJobStatusSchema>

export const SysJobQuerySchema = SysJobBaseSchema.pick({
  id: true,
  jobName: true,
  jobCode: true,
  handlerCode: true,
  status: true,
  runningStatus: true,
  remark: true,
})
export type SysJobQueryDTO = z.infer<typeof SysJobQuerySchema>

export const SysJobPageQuerySchema =
  SysJobQuerySchema.extend(ApiRequestSchema.shape)
export type SysJobPageQueryDTO = z.infer<typeof SysJobPageQuerySchema>
