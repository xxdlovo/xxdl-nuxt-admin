import z from 'zod'

export const SysConfigBaseSchema = z.object({
  id: z.string().nullish(),
  configName: z.string().nullish().meta({ query: 'like' }),
  configKey: z.string().nullish().meta({ query: 'like' }),
  configValue: z.string().nullish().meta({ query: 'like' }),
  configType: z.number().nullish(),
  status: z.number().nullish(),
  remark: z.string().nullish().meta({ query: 'like' }),
  createdBy: z.string().nullish(),
  createdAt: z.string().nullish(),
  updatedBy: z.string().nullish(),
  updatedAt: z.string().nullish(),
  isDeleted: z.number().nullish()
})

export type SysConfigDto = z.infer<typeof SysConfigBaseSchema>
