import { SysOssConfigBaseSchema } from './common'
import { z } from 'zod'

export const SysOssConfigRespSchema = z.object({
    id: SysOssConfigBaseSchema.shape.id,
    configKey: SysOssConfigBaseSchema.shape.configKey,
    configName: SysOssConfigBaseSchema.shape.configName,
    service: SysOssConfigBaseSchema.shape.service,
    endpoint: SysOssConfigBaseSchema.shape.endpoint,
    region: SysOssConfigBaseSchema.shape.region,
    bucketName: SysOssConfigBaseSchema.shape.bucketName,
    domain: SysOssConfigBaseSchema.shape.domain,
    prefix: SysOssConfigBaseSchema.shape.prefix,
    isHttps: SysOssConfigBaseSchema.shape.isHttps,
    accessPolicy: SysOssConfigBaseSchema.shape.accessPolicy,
    isDefault: SysOssConfigBaseSchema.shape.isDefault,
    verifyStatus: SysOssConfigBaseSchema.shape.verifyStatus,
    verifyTime: SysOssConfigBaseSchema.shape.verifyTime,
    verifyMessage: SysOssConfigBaseSchema.shape.verifyMessage,
    status: SysOssConfigBaseSchema.shape.status,
    remark: SysOssConfigBaseSchema.shape.remark,
    createdAt: SysOssConfigBaseSchema.shape.createdAt,
});
export type SysOssConfigRespDTO = z.infer<typeof SysOssConfigRespSchema>;
