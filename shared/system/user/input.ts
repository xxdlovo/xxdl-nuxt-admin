import { SysUserBaseSchema } from './common'
import { z } from 'zod'
import { ApiRequestSchema } from '#shared/types/common'

// add
export const SysUserAddSchema = SysUserBaseSchema.pick({
  nickname: true,
  avatar: true,
  phone: true,
  gender: true,
  deptId: true,
  status: true,
  remark: true
}).extend({
  id: SysUserBaseSchema.shape.id.nonoptional(),
  username: z.string().min(3, 'form.userName.required').max(50, 'form.userName.invalid'),
  password: z.string().min(6, 'form.pwd.required').max(255, 'form.pwd.invalid'),
  email: z.string().min(6, 'form.email.invalid')
})
export type SysUserAddDTO = z.infer<typeof SysUserAddSchema>

// update
export const SysUserUpdateSchema = SysUserBaseSchema.pick({
  username: true,
  email: true,
  nickname: true,
  avatar: true,
  phone: true,
  gender: true,
  deptId: true,
  status: true,
  remark: true
}).extend({
  id: z.string().nonempty('form.id.required'),
  username: z.string().min(3, 'form.userName.required').max(50, 'form.userName.invalid'),
  email: z.string().min(6, 'form.email.invalid')
})
export type SysUserUpdateDTO = z.infer<typeof SysUserUpdateSchema>

// reset password
export const SysUserResetPasswordSchema = z.object({
  id: z.string().min(1, 'form.id.required'),
  password: z.string().min(6, 'form.pwd.required').max(255, 'form.pwd.invalid'),
  confirmPassword: z.string().min(6, 'form.confirmPwd.required').max(255, 'form.confirmPwd.invalid')
}).refine(data => data.password === data.confirmPassword, {
  message: 'form.confirmPwd.invalid',
  path: ['confirmPassword']
})
export type SysUserResetPasswordDTO = z.infer<typeof SysUserResetPasswordSchema>

// query
export const SysUserQuerySchema = SysUserBaseSchema.pick({
  id: true,
  username: true,
  email: true,
  nickname: true,
  phone: true,
  gender: true,
  status: true,
  remark: true
})
export type SysUserQueryDTO = z.infer<typeof SysUserQuerySchema>

// page query
export const SysUserPageQuerySchema = SysUserBaseSchema.pick({
  id: true,
  username: true,
  email: true,
  nickname: true,
  phone: true,
  gender: true,
  status: true,
  remark: true
}).extend(ApiRequestSchema.shape)
export type SysUserPageQueryDTO = z.infer<typeof SysUserPageQuerySchema>
