import { SysLoginLogBaseSchema } from './common'
import { z } from 'zod'
import { ApiRequestSchema } from "#shared/types/common";

// add
export const SysLoginLogAddSchema =
    SysLoginLogBaseSchema.pick({
        userId: true,
        username: true,
        ip: true,
        location: true,
        browser: true,
        os: true,
        userAgent: true,
        status: true,
        remark: true,
    }).extend({
        id: SysLoginLogBaseSchema.shape.id.nonoptional(),
        username: z.string().min(1, 'form.required'),
        ip: z.string().min(1, 'form.required'),
        status: z.number().min(1, 'form.required'),
    })
export type SysLoginLogAddDTO = z.infer<typeof SysLoginLogAddSchema>;

// update
export const SysLoginLogUpdateSchema = SysLoginLogAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysLoginLogUpdateDTO = z.infer<typeof SysLoginLogUpdateSchema>;

// query
export const SysLoginLogQuerySchema = SysLoginLogBaseSchema.pick({
    id: true,
    userId: true,
    username: true,
    ip: true,
    location: true,
    status: true,
    remark: true,
})
export type SysLoginLogQueryDTO = z.infer<typeof SysLoginLogQuerySchema>;

// page query
export const SysLoginLogPageQuerySchema =
    SysLoginLogQuerySchema.extend(ApiRequestSchema.shape)
export type SysLoginLogPageQueryDTO = z.infer<typeof SysLoginLogPageQuerySchema>;
