import z from 'zod'

export const SysLogBaseSchema = z.object({
    id: z.string().nullish(),
    level: z.number().nullish(),
    module: z.string().nullish().meta({ query: 'like' }),
    message: z.string().nullish().meta({ query: 'like' }),
    trace: z.string().nullish(),
    status: z.number().nullish(),
    remark: z.string().nullish().meta({ query: 'like' }),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysLogDto = z.infer<typeof SysLogBaseSchema>
