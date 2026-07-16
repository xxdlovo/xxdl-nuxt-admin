import { SysLoginLogBaseSchema } from './common'
import { z } from 'zod'

export const SysLoginLogRespSchema = z.object({
    id: SysLoginLogBaseSchema.shape.id,
    userId: SysLoginLogBaseSchema.shape.userId,
    username: SysLoginLogBaseSchema.shape.username,
    ip: SysLoginLogBaseSchema.shape.ip,
    location: SysLoginLogBaseSchema.shape.location,
    browser: SysLoginLogBaseSchema.shape.browser,
    os: SysLoginLogBaseSchema.shape.os,
    userAgent: SysLoginLogBaseSchema.shape.userAgent,
    loginTime: SysLoginLogBaseSchema.shape.loginTime,
    status: SysLoginLogBaseSchema.shape.status,
    remark: SysLoginLogBaseSchema.shape.remark,
});
export type SysLoginLogRespDTO = z.infer<typeof SysLoginLogRespSchema>;
