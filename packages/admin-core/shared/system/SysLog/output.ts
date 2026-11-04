import { SysLogBaseSchema } from './common'
import { z } from 'zod'

export const SysLogRespSchema = z.object({
    id: SysLogBaseSchema.shape.id,
    userId: SysLogBaseSchema.shape.userId,
    username: SysLogBaseSchema.shape.username,
    ip: SysLogBaseSchema.shape.ip,
    userAgent: SysLogBaseSchema.shape.userAgent,
    browser: SysLogBaseSchema.shape.browser,
    os: SysLogBaseSchema.shape.os,
    requestMethod: SysLogBaseSchema.shape.requestMethod,
    requestPath: SysLogBaseSchema.shape.requestPath,
    trpcType: SysLogBaseSchema.shape.trpcType,
    trpcPath: SysLogBaseSchema.shape.trpcPath,
    durationMs: SysLogBaseSchema.shape.durationMs,
    requestParams: SysLogBaseSchema.shape.requestParams,
    requestResult: SysLogBaseSchema.shape.requestResult,
    errorCode: SysLogBaseSchema.shape.errorCode,
    traceId: SysLogBaseSchema.shape.traceId,
    level: SysLogBaseSchema.shape.level,
    module: SysLogBaseSchema.shape.module,
    message: SysLogBaseSchema.shape.message,
    trace: SysLogBaseSchema.shape.trace,
    status: SysLogBaseSchema.shape.status,
    remark: SysLogBaseSchema.shape.remark,
});
export type SysLogRespDTO = z.infer<typeof SysLogRespSchema>;
