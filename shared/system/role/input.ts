import { SysRoleBaseSchema } from './common'
import { z } from 'zod'
import { ApiRequestSchema } from "#shared/types/common";

// add
export const SysRoleAddSchema =
    SysRoleBaseSchema.pick({
        name: true,
        code: true,
        dataScope: true,
        description: true,
        sortOrder: true,
        status: true,
        remark: true,
    }).extend({
        id: SysRoleBaseSchema.shape.id.nonoptional(),
        name: z.string().min(1, 'form.required'),
        code: z.string().min(1, 'form.required'),
        dataScope: z.enum(['1', '2', '3', '4', '5', '6']).default('5'),
    })
export type SysRoleAddDTO = z.infer<typeof SysRoleAddSchema>;

// update
export const SysRoleUpdateSchema = SysRoleAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
    dataScope: z.enum(['1', '2', '3', '4', '5', '6']).optional(),
})
export type SysRoleUpdateDTO = z.infer<typeof SysRoleUpdateSchema>;

// query
export const SysRoleQuerySchema = SysRoleBaseSchema.pick({
    id: true,
    name: true,
    code: true,
    description: true,
    dataScope: true,
    status: true,
    remark: true,
})
export type SysRoleQueryDTO = z.infer<typeof SysRoleQuerySchema>;

// page query
export const SysRolePageQuerySchema =
    SysRoleBaseSchema.pick({
        id: true,
        name: true,
        code: true,
        description: true,
        dataScope: true,
        status: true,
        remark: true,
    }).extend(ApiRequestSchema.shape)
export type SysRolePageQueryDTO = z.infer<typeof SysRolePageQuerySchema>;
