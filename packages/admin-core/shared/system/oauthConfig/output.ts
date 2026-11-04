import { SysOauthConfigBaseSchema } from './common'
import { z } from 'zod'

export const SysOauthConfigRespSchema = z.object({
    id: SysOauthConfigBaseSchema.shape.id,
    platform: SysOauthConfigBaseSchema.shape.platform,
    platformName: SysOauthConfigBaseSchema.shape.platformName,
    icon: SysOauthConfigBaseSchema.shape.icon,
    clientId: SysOauthConfigBaseSchema.shape.clientId,
    clientSecret: SysOauthConfigBaseSchema.shape.clientSecret,
    redirectUrl: SysOauthConfigBaseSchema.shape.redirectUrl,
    scope: SysOauthConfigBaseSchema.shape.scope,
    defaultRoleId: SysOauthConfigBaseSchema.shape.defaultRoleId,
    status: SysOauthConfigBaseSchema.shape.status,
    sortOrder: SysOauthConfigBaseSchema.shape.sortOrder,
    extra: SysOauthConfigBaseSchema.shape.extra,
    remark: SysOauthConfigBaseSchema.shape.remark,
    createdBy: SysOauthConfigBaseSchema.shape.createdBy,
    createdAt: SysOauthConfigBaseSchema.shape.createdAt,
    updatedBy: SysOauthConfigBaseSchema.shape.updatedBy,
    updatedAt: SysOauthConfigBaseSchema.shape.updatedAt,
});
export type SysOauthConfigRespDTO = z.infer<typeof SysOauthConfigRespSchema>;

/**
 * 登录页展示用的已启用平台。
 * 只暴露可公开字段，绝不含 clientId / clientSecret。
 */
export const SysOauthEnabledPlatformSchema = z.object({
    platform: z.string(),
    platformName: z.string(),
    icon: z.string().nullish(),
});
export type SysOauthEnabledPlatformDTO = z.infer<typeof SysOauthEnabledPlatformSchema>;
