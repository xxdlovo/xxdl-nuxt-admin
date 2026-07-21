import z from 'zod'

export const SysRoleBaseSchema = z.object({
    id: z.string().nullish(),
    name: z.string().nullish().meta({ query: 'like' }),
    code: z.string().nullish().meta({ query: 'like' }),
    dataScope: z.string().nullish(),
    description: z.string().nullish().meta({ query: 'like' }),
    isSystem: z.number().nullish(),
    sortOrder: z.number().nullish(),
    status: z.number().nullish(),
    remark: z.string().nullish().meta({ query: 'like' }),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysRoleDto = z.infer<typeof SysRoleBaseSchema>
