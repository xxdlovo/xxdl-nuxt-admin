import z from 'zod'

export const SysJobLogBaseSchema = z.object({
  id: z.string().nullish(),
  jobId: z.string().nullish(),
  jobName: z.string().nullish().meta({ query: 'like' }),
  jobCode: z.string().nullish().meta({ query: 'like' }),
  handlerCode: z.string().nullish(),
  cronExpression: z.string().nullish(),
  triggerType: z.string().nullish(),
  status: z.number().nullish(),
  startedAt: z.string().nullish(),
  finishedAt: z.string().nullish(),
  durationMs: z.number().nullish(),
  result: z.unknown().nullish(),
  errorMessage: z.string().nullish(),
  errorStack: z.string().nullish(),
  createdBy: z.string().nullish(),
  createdAt: z.string().nullish(),
  updatedBy: z.string().nullish(),
  updatedAt: z.string().nullish(),
  isDeleted: z.number().nullish(),
})

export type SysJobLogDto = z.infer<typeof SysJobLogBaseSchema>
