import z from 'zod'

export const SysMenuBaseSchema = z.object({
    id: z.string().nullish(),
    parentId: z.string().nullish(),
    name: z.string().nullish().meta({ query: 'like' }),
    code: z.string().nullish().meta({ query: 'like' }),
    type: z.number().nullish(),
    path: z.string().nullish(),
    component: z.string().nullish(),
    icon: z.string().nullish(),
    sortOrder: z.number().nullish(),
    visible: z.number().nullish(),
    status: z.number().nullish(),
    remark: z.string().nullish().meta({ query: 'like' }),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysMenuDto = z.infer<typeof SysMenuBaseSchema>
