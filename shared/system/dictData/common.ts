import z from 'zod'

export const SysDictDataBaseSchema = z.object({
    id: z.string().nullish(),
    typeId: z.string().nullish(),
    label: z.string().nullish().meta({ query: 'like' }),
    value: z.string().nullish().meta({ query: 'like' }),
    sortOrder: z.number().nullish(),
    status: z.number().nullish(),
    remark: z.string().nullish().meta({ query: 'like' }),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysDictDataDto = z.infer<typeof SysDictDataBaseSchema>
