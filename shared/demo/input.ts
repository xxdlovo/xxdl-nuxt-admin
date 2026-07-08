import { DemoBaseSchema } from './common'
import { z } from 'zod'
import { ApiQueryRequestSchema, ApiRequestSchema } from "#shared/types/common";

// add
export const DemoAddSchema =
    DemoBaseSchema.pick({
        field1: true,
        field2: true,
        status: true,
        remark: true,
    }).extend({
        id: DemoBaseSchema.shape.id.nonoptional()

    })
export type DemoAddDTO = z.infer<typeof DemoAddSchema>;

// update
export const DemoUpdateSchema = DemoAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type DemoUpdateDTO = z.infer<typeof DemoUpdateSchema>;

// query
export const DemoQuerySchema = DemoBaseSchema.pick({
    id: true,
    field1: true,
    field2: true,
    status: true,
    remark: true,
})
export type DemoQueryDTO = z.infer<typeof DemoQuerySchema>;

// page query
export const DemoPageQuerySchema =
DemoQuerySchema.pick({
    id: true,
    field1: true,
    field2: true,
    status: true,
    remark: true,
}).extend(ApiRequestSchema.shape)

export type DemoPageQueryDTO = z.infer<typeof DemoPageQuerySchema>;