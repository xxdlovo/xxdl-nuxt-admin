import { SysDictTypeBaseSchema } from './common'
import { z } from 'zod'
import { ApiRequestSchema } from "#shared/types/common";

// add
export const SysDictTypeAddSchema =
    SysDictTypeBaseSchema.pick({
        name: true,
        code: true,
        status: true,
        remark: true,
    }).extend({
        id: SysDictTypeBaseSchema.shape.id.nonoptional(),
        name: z.string().min(1, 'form.required'),
        code: z.string().min(1, 'form.required'),
    })
export type SysDictTypeAddDTO = z.infer<typeof SysDictTypeAddSchema>;

// update
export const SysDictTypeUpdateSchema = SysDictTypeAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysDictTypeUpdateDTO = z.infer<typeof SysDictTypeUpdateSchema>;

// query
export const SysDictTypeQuerySchema = SysDictTypeBaseSchema.pick({
    id: true,
    name: true,
    code: true,
    status: true,
    remark: true,
})
export type SysDictTypeQueryDTO = z.infer<typeof SysDictTypeQuerySchema>;

// page query
export const SysDictTypePageQuerySchema =
    SysDictTypeBaseSchema.pick({
        id: true,
        name: true,
        code: true,
        status: true,
        remark: true,
    }).extend(ApiRequestSchema.shape)
export type SysDictTypePageQueryDTO = z.infer<typeof SysDictTypePageQuerySchema>;
