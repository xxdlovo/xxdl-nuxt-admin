import { z } from 'zod'
import { SysOnlineSessionBaseSchema } from './common'
import { ApiRequestSchema } from '#admin/shared/types/common'

/** 在线会话分页查询 */
export const SysOnlinePageQuerySchema = SysOnlineSessionBaseSchema.pick({
    username: true,
    ip: true,
}).extend(ApiRequestSchema.shape)

export type SysOnlinePageQueryDTO = z.infer<typeof SysOnlinePageQuerySchema>

/** 强制下线：按会话 id */
export const SysOnlineForceLogoutSchema = z.object({
    sessionId: z.string().min(1, 'form.id.required'),
})

export type SysOnlineForceLogoutDTO = z.infer<typeof SysOnlineForceLogoutSchema>

/** 批量强制下线 */
export const SysOnlineBatchForceLogoutSchema = z.array(
    z.string().min(1, 'form.id.required')
).min(1, 'form.id.required')

export type SysOnlineBatchForceLogoutDTO = z.infer<typeof SysOnlineBatchForceLogoutSchema>
