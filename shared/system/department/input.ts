import { SysDeptBaseSchema } from './common'
import { z } from 'zod'
import { ApiRequestSchema } from "#shared/types/common";

// add
export const SysDeptAddSchema =
    SysDeptBaseSchema.pick({
        name: true,
        code: true,
        parentId: true,
        path: true,
        level: true,
        sortOrder: true,
        leader: true,
        phone: true,
        email: true,
        status: true,
        remark: true,
    }).extend({
        id: SysDeptBaseSchema.shape.id.nonoptional(),
        name: z.string().min(1, 'form.required'),
        code: z.string().min(1, 'form.required'),
    })
export type SysDeptAddDTO = z.infer<typeof SysDeptAddSchema>;

// update
export const SysDeptUpdateSchema = SysDeptAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysDeptUpdateDTO = z.infer<typeof SysDeptUpdateSchema>;

// query
export const SysDeptQuerySchema = SysDeptBaseSchema.pick({
    id: true,
    name: true,
    code: true,
    parentId: true,
    path: true,
    level: true,
    sortOrder: true,
    leader: true,
    phone: true,
    email: true,
    status: true,
    remark: true,
})
export type SysDeptQueryDTO = z.infer<typeof SysDeptQuerySchema>;

// page query
export const SysDeptPageQuerySchema =
    SysDeptBaseSchema.pick({
        id: true,
        name: true,
        code: true,
        parentId: true,
        path: true,
        level: true,
        sortOrder: true,
        leader: true,
        phone: true,
        email: true,
        status: true,
        remark: true,
    }).extend(ApiRequestSchema.shape)
export type SysDeptPageQueryDTO = z.infer<typeof SysDeptPageQuerySchema>;
