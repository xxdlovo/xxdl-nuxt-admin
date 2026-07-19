import { SysUserRoleBaseSchema } from './common'
import { z } from 'zod'
import { ApiRequestSchema } from '#shared/types/common'

// add
export const SysUserRoleAddSchema = SysUserRoleBaseSchema.pick({
  userId: true,
  roleId: true,
  status: true,
  remark: true
}).extend({
  id: SysUserRoleBaseSchema.shape.id.nonoptional(),
  userId: z.string().min(1, 'form.required'),
  roleId: z.string().min(1, 'form.required')
})
export type SysUserRoleAddDTO = z.infer<typeof SysUserRoleAddSchema>

// update
export const SysUserRoleUpdateSchema = SysUserRoleAddSchema.extend({
  id: z.string().nonempty('form.id.required')
})
export type SysUserRoleUpdateDTO = z.infer<typeof SysUserRoleUpdateSchema>

// query
export const SysUserRoleQuerySchema = SysUserRoleBaseSchema.pick({
  id: true,
  userId: true,
  roleId: true,
  status: true,
  remark: true
})
export type SysUserRoleQueryDTO = z.infer<typeof SysUserRoleQuerySchema>

// page query
export const SysUserRolePageQuerySchema = SysUserRoleBaseSchema.pick({
  id: true,
  userId: true,
  roleId: true,
  status: true,
  remark: true
}).extend(ApiRequestSchema.shape)
export type SysUserRolePageQueryDTO = z.infer<typeof SysUserRolePageQuerySchema>

// assign
export const SysUserRoleAssignSchema = z.object({
  userId: z.string().min(1, 'form.required'),
  roleIds: z.array(z.string()).default([])
})
export type SysUserRoleAssignDTO = z.infer<typeof SysUserRoleAssignSchema>

export const SysUserRoleAssignedIdsQuerySchema = z.object({
  userId: z.string().min(1, 'form.required')
})
export type SysUserRoleAssignedIdsQueryDTO = z.infer<typeof SysUserRoleAssignedIdsQuerySchema>
