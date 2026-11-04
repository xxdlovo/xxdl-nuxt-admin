import { SysUserRoleBaseSchema } from './common'
import { z } from 'zod'

export const SysUserRoleRespSchema = z.object({
    id: SysUserRoleBaseSchema.shape.id,
    userId: SysUserRoleBaseSchema.shape.userId,
    roleId: SysUserRoleBaseSchema.shape.roleId,
    status: SysUserRoleBaseSchema.shape.status,
    remark: SysUserRoleBaseSchema.shape.remark,
});
export type SysUserRoleRespDTO = z.infer<typeof SysUserRoleRespSchema>;
