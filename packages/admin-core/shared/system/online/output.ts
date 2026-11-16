import { z } from 'zod'
import { SysOnlineSessionBaseSchema } from './common'
import { TrpcPageResponseSchema } from '#admin/shared/types/common'

export const SysOnlineSessionRespSchema = z.object({
    id: SysOnlineSessionBaseSchema.shape.id,
    userId: SysOnlineSessionBaseSchema.shape.userId,
    username: SysOnlineSessionBaseSchema.shape.username,
    ip: SysOnlineSessionBaseSchema.shape.ip,
    browser: SysOnlineSessionBaseSchema.shape.browser,
    os: SysOnlineSessionBaseSchema.shape.os,
    loginAt: SysOnlineSessionBaseSchema.shape.loginAt,
    lastSeenAt: SysOnlineSessionBaseSchema.shape.lastSeenAt,
    expiresAt: SysOnlineSessionBaseSchema.shape.expiresAt,
})

export type SysOnlineSessionRespDTO = z.infer<typeof SysOnlineSessionRespSchema>

export const SysOnlinePageRespSchema = TrpcPageResponseSchema(SysOnlineSessionRespSchema)
export type SysOnlinePageRespDTO = z.infer<typeof SysOnlinePageRespSchema>
