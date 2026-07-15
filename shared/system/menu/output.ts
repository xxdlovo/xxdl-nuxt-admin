import { SysMenuBaseSchema } from './common'
import { z } from 'zod'

export const SysMenuRespSchema = z.object({
    id: SysMenuBaseSchema.shape.id,
    parentId: SysMenuBaseSchema.shape.parentId,
    name: SysMenuBaseSchema.shape.name,
    code: SysMenuBaseSchema.shape.code,
    type: SysMenuBaseSchema.shape.type,
    path: SysMenuBaseSchema.shape.path,
    component: SysMenuBaseSchema.shape.component,
    icon: SysMenuBaseSchema.shape.icon,
    sortOrder: SysMenuBaseSchema.shape.sortOrder,
    visible: SysMenuBaseSchema.shape.visible,
    status: SysMenuBaseSchema.shape.status,
    remark: SysMenuBaseSchema.shape.remark,
});
export type SysMenuRespDTO = z.infer<typeof SysMenuRespSchema>;
