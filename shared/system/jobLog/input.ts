import { SysJobLogBaseSchema } from './common'
import { z } from 'zod'
import { ApiRequestSchema } from '#shared/types/common'

export const SysJobLogQuerySchema = SysJobLogBaseSchema.pick({
  id: true,
  jobId: true,
  jobName: true,
  jobCode: true,
  handlerCode: true,
  triggerType: true,
  status: true,
})
export type SysJobLogQueryDTO = z.infer<typeof SysJobLogQuerySchema>

export const SysJobLogPageQuerySchema =
  SysJobLogQuerySchema.extend(ApiRequestSchema.shape)
export type SysJobLogPageQueryDTO = z.infer<typeof SysJobLogPageQuerySchema>
