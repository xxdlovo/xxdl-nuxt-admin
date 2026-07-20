import { SysOssConfigBaseSchema } from './common'
import { z } from 'zod'
import { ApiRequestSchema } from "#shared/types/common";

// add
export const SysOssConfigAddSchema =
    SysOssConfigBaseSchema.pick({
        configKey: true,
        configName: true,
        service: true,
        endpoint: true,
        region: true,
        bucketName: true,
        accessKey: true,
        secretKey: true,
        domain: true,
        prefix: true,
        isHttps: true,
        accessPolicy: true,
        isDefault: true,
        status: true,
        remark: true,
    }).extend({
        id: SysOssConfigBaseSchema.shape.id.nonoptional(),
        configKey: z.string().min(1, 'form.required').max(100, 'form.required'),
        configName: z.string().min(1, 'form.required').max(100, 'form.required'),
        service: z.string().min(1, 'form.required').max(50, 'form.required'),
    })
export type SysOssConfigAddDTO = z.infer<typeof SysOssConfigAddSchema>;

// update
export const SysOssConfigUpdateSchema = SysOssConfigAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysOssConfigUpdateDTO = z.infer<typeof SysOssConfigUpdateSchema>;

// query
export const SysOssConfigQuerySchema = SysOssConfigBaseSchema.pick({
    id: true,
    configKey: true,
    configName: true,
    service: true,
    endpoint: true,
    bucketName: true,
    domain: true,
    isDefault: true,
    status: true,
    remark: true,
})
export type SysOssConfigQueryDTO = z.infer<typeof SysOssConfigQuerySchema>;

// page query
export const SysOssConfigPageQuerySchema =
    SysOssConfigQuerySchema.extend(ApiRequestSchema.shape)
export type SysOssConfigPageQueryDTO = z.infer<typeof SysOssConfigPageQuerySchema>;
