import { SysOssBaseSchema } from './common'
import { z } from 'zod'

export const SysOssRespSchema = z.object({
    id: SysOssBaseSchema.shape.id,
    fileName: SysOssBaseSchema.shape.fileName,
    originalName: SysOssBaseSchema.shape.originalName,
    fileSuffix: SysOssBaseSchema.shape.fileSuffix,
    fileSize: SysOssBaseSchema.shape.fileSize,
    contentType: SysOssBaseSchema.shape.contentType,
    bucketName: SysOssBaseSchema.shape.bucketName,
    objectName: SysOssBaseSchema.shape.objectName,
    url: SysOssBaseSchema.shape.url,
    service: SysOssBaseSchema.shape.service,
    status: SysOssBaseSchema.shape.status,
    remark: SysOssBaseSchema.shape.remark,
    createdAt: SysOssBaseSchema.shape.createdAt,
});
export type SysOssRespDTO = z.infer<typeof SysOssRespSchema>;
