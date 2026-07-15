import { SysDictDataBaseSchema } from './common'
import { z } from 'zod'
import { ApiRequestSchema } from "#shared/types/common";

// add
export const SysDictDataAddSchema =
    SysDictDataBaseSchema.pick({
        typeId: true,
        label: true,
        value: true,
        sortOrder: true,
        status: true,
        remark: true,
    }).extend({
        id: SysDictDataBaseSchema.shape.id.nonoptional(),
        typeId: z.string().min(1, 'form.required'),
        label: z.string().min(1, 'form.required'),
        value: z.string().min(1, 'form.required'),
    })
export type SysDictDataAddDTO = z.infer<typeof SysDictDataAddSchema>;

// update
export const SysDictDataUpdateSchema = SysDictDataAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysDictDataUpdateDTO = z.infer<typeof SysDictDataUpdateSchema>;

// query
export const SysDictDataQuerySchema = SysDictDataBaseSchema.pick({
    id: true,
    typeId: true,
    label: true,
    value: true,
    sortOrder: true,
    status: true,
    remark: true,
})
export type SysDictDataQueryDTO = z.infer<typeof SysDictDataQuerySchema>;

// page query
export const SysDictDataPageQuerySchema =
    SysDictDataBaseSchema.pick({
        id: true,
        typeId: true,
        label: true,
        value: true,
        sortOrder: true,
        status: true,
        remark: true,
    }).extend(ApiRequestSchema.shape)
export type SysDictDataPageQueryDTO = z.infer<typeof SysDictDataPageQuerySchema>;
