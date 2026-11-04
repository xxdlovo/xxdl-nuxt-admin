import z from 'zod'

export const SysDictTypeBaseSchema = z.object({
    id: z.string().nullish(),
    name: z.string().nullish().meta({ query: 'like' }),
    code: z.string().nullish().meta({ query: 'like' }),
    status: z.number().nullish(),
    remark: z.string().nullish().meta({ query: 'like' }),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysDictTypeDto = z.infer<typeof SysDictTypeBaseSchema>
