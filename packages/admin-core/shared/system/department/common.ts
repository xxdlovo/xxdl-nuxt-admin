import z from 'zod'

export const SysDeptBaseSchema = z.object({
    id: z.string().nullish(),
    name: z.string().nullish().meta({ query: 'like' }),
    code: z.string().nullish().meta({ query: 'like' }),
    parentId: z.string().nullish(),
    path: z.string().nullish(),
    level: z.number().nullish(),
    sortOrder: z.number().nullish(),
    leader: z.string().nullish().meta({ query: 'like' }),
    phone: z.string().nullish(),
    email: z.string().nullish(),
    status: z.number().nullish(),
    remark: z.string().nullish().meta({ query: 'like' }),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysDeptDto = z.infer<typeof SysDeptBaseSchema>
