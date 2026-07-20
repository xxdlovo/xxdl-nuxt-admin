import { SysOssBaseSchema } from './common'
import { z } from 'zod'
import { ApiRequestSchema } from "#shared/types/common";

// add
export const SysOssAddSchema =
    SysOssBaseSchema.pick({
        configId: true,
        fileName: true,
        originalName: true,
        fileSuffix: true,
        fileSize: true,
        contentType: true,
        bucketName: true,
        objectName: true,
        url: true,
        md5: true,
        etag: true,
        service: true,
        uploadUserId: true,
        status: true,
        remark: true,
    }).extend({
        id: SysOssBaseSchema.shape.id.nonoptional(),
        fileName: z.string().min(1, 'form.required'),
        originalName: z.string().min(1, 'form.required'),
        objectName: z.string().min(1, 'form.required'),
        url: z.string().min(1, 'form.required'),
        service: z.string().min(1, 'form.required'),
    })
export type SysOssAddDTO = z.infer<typeof SysOssAddSchema>;

// update
export const SysOssUpdateSchema = SysOssAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysOssUpdateDTO = z.infer<typeof SysOssUpdateSchema>;

// query
export const SysOssQuerySchema = SysOssBaseSchema.pick({
    id: true,
    fileName: true,
    originalName: true,
    fileSuffix: true,
    bucketName: true,
    objectName: true,
    service: true,
    status: true,
    uploadUserId: true,
    remark: true,
})
export type SysOssQueryDTO = z.infer<typeof SysOssQuerySchema>;

// page query
export const SysOssPageQuerySchema =
    SysOssQuerySchema.extend(ApiRequestSchema.shape)
export type SysOssPageQueryDTO = z.infer<typeof SysOssPageQuerySchema>;
