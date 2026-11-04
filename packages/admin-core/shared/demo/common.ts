import z from 'zod'

export const DemoBaseSchema = z.object({
    id: z.string().nullish(),
    field1: z.string().nullish().meta(
        {
            query: 'like'
        }
    ),
    field2: z.string().nullish().meta(
        {
            query: 'like'
        }
    ),
    status: z.number().nullish(),
    remark: z.string().nullish().meta(
        {
            query: 'like'
        }
    ),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type DemoDto = z.infer<typeof DemoBaseSchema>
