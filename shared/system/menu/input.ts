import { SysMenuBaseSchema } from './common'
import { z } from 'zod'
import { ApiRequestSchema } from "#shared/types/common";

// add
export const SysMenuAddSchema =
    SysMenuBaseSchema.pick({
        parentId: true,
        name: true,
        code: true,
        type: true,
        path: true,
        component: true,
        icon: true,
        sortOrder: true,
        visible: true,
        status: true,
        remark: true,
    }).extend({
        id: SysMenuBaseSchema.shape.id.nonoptional(),
        name: z.string().min(1, 'form.required'),
        code: z.string().min(1, 'form.required'),
        type: z.number('form.required'),
    })
export type SysMenuAddDTO = z.infer<typeof SysMenuAddSchema>;

// update
export const SysMenuUpdateSchema = SysMenuAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysMenuUpdateDTO = z.infer<typeof SysMenuUpdateSchema>;

// query
export const SysMenuQuerySchema = SysMenuBaseSchema.pick({
    id: true,
    parentId: true,
    name: true,
    code: true,
    type: true,
    path: true,
    component: true,
    icon: true,
    sortOrder: true,
    visible: true,
    status: true,
    remark: true,
})
export type SysMenuQueryDTO = z.infer<typeof SysMenuQuerySchema>;

// page query
export const SysMenuPageQuerySchema =
    SysMenuBaseSchema.pick({
        id: true,
        parentId: true,
        name: true,
        code: true,
        type: true,
        path: true,
        component: true,
        icon: true,
        sortOrder: true,
        visible: true,
        status: true,
        remark: true,
    }).extend(ApiRequestSchema.shape)
export type SysMenuPageQueryDTO = z.infer<typeof SysMenuPageQuerySchema>;
