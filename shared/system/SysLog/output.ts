import { SysLogBaseSchema } from './common'
import { z } from 'zod'

export const SysLogRespSchema = z.object({
    id: SysLogBaseSchema.shape.id,
    level: SysLogBaseSchema.shape.level,
    module: SysLogBaseSchema.shape.module,
    message: SysLogBaseSchema.shape.message,
    trace: SysLogBaseSchema.shape.trace,
    status: SysLogBaseSchema.shape.status,
    remark: SysLogBaseSchema.shape.remark,
});
export type SysLogRespDTO = z.infer<typeof SysLogRespSchema>;
