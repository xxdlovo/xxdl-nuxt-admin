import z from 'zod'

export const SysJobBaseSchema = z.object({
  id: z.string().nullish(),
  jobName: z.string().nullish().meta({ query: 'like' }),
  jobCode: z.string().nullish().meta({ query: 'like' }),
  handlerCode: z.string().nullish(),
  cronExpression: z.string().nullish(),
  cronTimezone: z.string().nullish(),
  status: z.number().nullish(),
  runningStatus: z.number().nullish(),
  lastRunAt: z.string().nullish(),
  nextRunAt: z.string().nullish(),
  lastSuccessAt: z.string().nullish(),
  lastFailAt: z.string().nullish(),
  lastDurationMs: z.number().nullish(),
  lastError: z.string().nullish(),
  sortOrder: z.number().nullish(),
  remark: z.string().nullish().meta({ query: 'like' }),
  createdBy: z.string().nullish(),
  createdAt: z.string().nullish(),
  updatedBy: z.string().nullish(),
  updatedAt: z.string().nullish(),
  isDeleted: z.number().nullish(),
})

export type SysJobDto = z.infer<typeof SysJobBaseSchema>

export const SysJobHandlerSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().nullish(),
})
export type SysJobHandlerDTO = z.infer<typeof SysJobHandlerSchema>
