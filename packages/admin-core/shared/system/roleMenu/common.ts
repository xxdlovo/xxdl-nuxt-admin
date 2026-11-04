import z from 'zod'

export const SysRoleMenuBaseSchema = z.object({
    id: z.string().nullish(),
    roleId: z.string().nullish(),
    menuId: z.string().nullish(),
    status: z.number().nullish(),
    remark: z.string().nullish().meta({ query: 'like' }),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysRoleMenuDto = z.infer<typeof SysRoleMenuBaseSchema>
