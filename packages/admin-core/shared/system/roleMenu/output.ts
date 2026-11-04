import { SysRoleMenuBaseSchema } from './common'
import { z } from 'zod'

export const SysRoleMenuRespSchema = z.object({
    id: SysRoleMenuBaseSchema.shape.id,
    roleId: SysRoleMenuBaseSchema.shape.roleId,
    menuId: SysRoleMenuBaseSchema.shape.menuId,
    status: SysRoleMenuBaseSchema.shape.status,
    remark: SysRoleMenuBaseSchema.shape.remark,
});
export type SysRoleMenuRespDTO = z.infer<typeof SysRoleMenuRespSchema>;
