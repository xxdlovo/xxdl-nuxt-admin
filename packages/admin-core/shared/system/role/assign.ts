import { z } from 'zod'

export const SysRoleAssignUsersSchema = z.object({
    roleId: z.string().min(1, 'form.id.required'),
    userIds: z.array(z.string()).default([]),
})
export type SysRoleAssignUsersDTO = z.infer<typeof SysRoleAssignUsersSchema>

export const SysRoleAssignedUserIdsQuerySchema = z.object({
    roleId: z.string().min(1, 'form.id.required'),
})
export type SysRoleAssignedUserIdsQueryDTO = z.infer<typeof SysRoleAssignedUserIdsQuerySchema>

export const SysRoleAssignableUsersQuerySchema = z.object({
    keyword: z.string().max(50).optional(),
    limit: z.number().int().min(1).max(500).default(200),
})
export type SysRoleAssignableUsersQueryDTO = z.infer<typeof SysRoleAssignableUsersQuerySchema>
