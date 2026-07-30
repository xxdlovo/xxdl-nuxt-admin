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

const SysUserPasswordFieldsSchema = z.object({
  password: z.string().min(6, 'form.pwd.required').max(255, 'form.pwd.invalid'),
  confirmPassword: z.string().min(6, 'form.confirmPwd.required').max(255, 'form.confirmPwd.invalid')
})

const withMatchingPasswords = <T extends z.ZodType>(schema: T) => schema.refine(data => {
  const values = data as { password: string, confirmPassword: string }
  return values.password === values.confirmPassword
}, {
  message: 'form.confirmPwd.invalid',
  path: ['confirmPassword']
})

// reset password
export const SysUserResetPasswordSchema = withMatchingPasswords(
  SysUserPasswordFieldsSchema.extend({
    id: z.string().min(1, 'form.id.required')
  })
)
export type SysUserResetPasswordDTO = z.infer<typeof SysUserResetPasswordSchema>

// current user profile update
export const SysUserProfileUpdateSchema = SysUserBaseSchema.pick({
  nickname: true,
  email: true,
  phone: true,
  avatar: true,
  gender: true,
  remark: true
}).extend({
  nickname: z.string().max(50, 'form.userName.invalid').optional(),
  email: z.string().min(6, 'form.email.required').max(100, 'form.email.invalid'),
  phone: z.string().max(20, 'form.phone.invalid').optional(),
  avatar: z.string().max(255, 'form.required').optional(),
  gender: z.number().optional(),
  remark: z.string().max(500, 'form.required').optional()
})
export type SysUserProfileUpdateDTO = z.infer<typeof SysUserProfileUpdateSchema>

// current user password change, requires old password check in auth service
export const SysUserChangePasswordSchema = withMatchingPasswords(
  SysUserPasswordFieldsSchema.extend({
    oldPassword: z.string().min(1, 'form.pwd.required')
  })
)
export type SysUserChangePasswordDTO = z.infer<typeof SysUserChangePasswordSchema>

// public registration
export const SysUserRegisterSchema = withMatchingPasswords(
  SysUserPasswordFieldsSchema.extend({
    phone: z.string().min(1, 'form.phone.required').max(20, 'form.phone.invalid'),
    username: z.string().min(3, 'form.userName.required').max(50, 'form.userName.invalid')
  })
)
export type SysUserRegisterDTO = z.infer<typeof SysUserRegisterSchema>

// query
export const SysUserQuerySchema = SysUserBaseSchema.pick({
  id: true,
  username: true,
  email: true,
  nickname: true,
  phone: true,
  deptId: true,
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
  deptId: true,
  gender: true,
  status: true,
  remark: true
}).extend(ApiRequestSchema.shape)
export type SysUserPageQueryDTO = z.infer<typeof SysUserPageQuerySchema>
