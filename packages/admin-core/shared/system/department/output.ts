import { SysDeptBaseSchema } from './common'
import { z } from 'zod'

export const SysDeptRespSchema = z.object({
    id: SysDeptBaseSchema.shape.id,
    name: SysDeptBaseSchema.shape.name,
    code: SysDeptBaseSchema.shape.code,
    parentId: SysDeptBaseSchema.shape.parentId,
    path: SysDeptBaseSchema.shape.path,
    level: SysDeptBaseSchema.shape.level,
    sortOrder: SysDeptBaseSchema.shape.sortOrder,
    leader: SysDeptBaseSchema.shape.leader,
    phone: SysDeptBaseSchema.shape.phone,
    email: SysDeptBaseSchema.shape.email,
    status: SysDeptBaseSchema.shape.status,
    remark: SysDeptBaseSchema.shape.remark,
});
export type SysDeptRespDTO = z.infer<typeof SysDeptRespSchema>;
