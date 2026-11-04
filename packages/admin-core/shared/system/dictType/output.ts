import { SysDictTypeBaseSchema } from './common'
import { z } from 'zod'

export const SysDictTypeRespSchema = z.object({
    id: SysDictTypeBaseSchema.shape.id,
    name: SysDictTypeBaseSchema.shape.name,
    code: SysDictTypeBaseSchema.shape.code,
    status: SysDictTypeBaseSchema.shape.status,
    remark: SysDictTypeBaseSchema.shape.remark,
});
export type SysDictTypeRespDTO = z.infer<typeof SysDictTypeRespSchema>;
