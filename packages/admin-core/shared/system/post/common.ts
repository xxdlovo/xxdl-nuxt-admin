import z from 'zod'

export const SysPostBaseSchema = z.object({
    id: z.string().nullish(),
    code: z.string().nullish().meta({ query: 'like' }),
    name: z.string().nullish().meta({ query: 'like' }),
    sortOrder: z.number().nullish(),
    status: z.number().nullish(),
    remark: z.string().nullish().meta({ query: 'like' }),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})

export type SysPostDto = z.infer<typeof SysPostBaseSchema>
