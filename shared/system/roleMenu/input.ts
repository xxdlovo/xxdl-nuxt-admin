import { SysRoleMenuBaseSchema } from './common'
import { z } from 'zod'
import { ApiRequestSchema } from "#shared/types/common";

// add
export const SysRoleMenuAddSchema =
    SysRoleMenuBaseSchema.pick({
        roleId: true,
        menuId: true,
        status: true,
        remark: true,
    }).extend({
        id: SysRoleMenuBaseSchema.shape.id.nonoptional(),
        roleId: z.string().min(1, 'form.required'),
        menuId: z.string().min(1, 'form.required'),
    })
export type SysRoleMenuAddDTO = z.infer<typeof SysRoleMenuAddSchema>;

// update
export const SysRoleMenuUpdateSchema = SysRoleMenuAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysRoleMenuUpdateDTO = z.infer<typeof SysRoleMenuUpdateSchema>;

// query
export const SysRoleMenuQuerySchema = SysRoleMenuBaseSchema.pick({
    id: true,
    roleId: true,
    menuId: true,
    status: true,
    remark: true,
})
export type SysRoleMenuQueryDTO = z.infer<typeof SysRoleMenuQuerySchema>;

// page query
export const SysRoleMenuPageQuerySchema =
    SysRoleMenuQuerySchema.extend(ApiRequestSchema.shape)
export type SysRoleMenuPageQueryDTO = z.infer<typeof SysRoleMenuPageQuerySchema>;
