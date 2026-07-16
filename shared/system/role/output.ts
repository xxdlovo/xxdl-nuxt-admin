import { SysRoleBaseSchema } from './common'
import { z } from 'zod'

export const SysRoleRespSchema = z.object({
    id: SysRoleBaseSchema.shape.id,
    name: SysRoleBaseSchema.shape.name,
    code: SysRoleBaseSchema.shape.code,
    description: SysRoleBaseSchema.shape.description,
    sortOrder: SysRoleBaseSchema.shape.sortOrder,
    status: SysRoleBaseSchema.shape.status,
    remark: SysRoleBaseSchema.shape.remark,
});
export type SysRoleRespDTO = z.infer<typeof SysRoleRespSchema>;
