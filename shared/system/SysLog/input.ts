import { SysLogBaseSchema } from './common'
import { z } from 'zod'
import { ApiRequestSchema } from "#shared/types/common";

// add
export const SysLogAddSchema =
    SysLogBaseSchema.pick({
        level: true,
        module: true,
        message: true,
        trace: true,
        status: true,
        remark: true,
    }).extend({
        id: SysLogBaseSchema.shape.id.nonoptional(),
        level: z.number(),
        message: z.string().min(1, 'form.required'),
    })
export type SysLogAddDTO = z.infer<typeof SysLogAddSchema>;

// update
export const SysLogUpdateSchema = SysLogAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysLogUpdateDTO = z.infer<typeof SysLogUpdateSchema>;

// query
export const SysLogQuerySchema = SysLogBaseSchema.pick({
    id: true,
    level: true,
    module: true,
    message: true,
    status: true,
    remark: true,
})
export type SysLogQueryDTO = z.infer<typeof SysLogQuerySchema>;

// page query
export const SysLogPageQuerySchema =
    SysLogBaseSchema.pick({
        id: true,
        level: true,
        module: true,
        message: true,
        status: true,
        remark: true,
    }).extend(ApiRequestSchema.shape)
export type SysLogPageQueryDTO = z.infer<typeof SysLogPageQuerySchema>;
