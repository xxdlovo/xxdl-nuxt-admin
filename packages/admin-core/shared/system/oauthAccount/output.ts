import { SysOauthAccountBaseSchema } from './common'
import { z } from 'zod'

export const SysOauthAccountRespSchema = z.object({
    id: SysOauthAccountBaseSchema.shape.id,
    userId: SysOauthAccountBaseSchema.shape.userId,
    provider: SysOauthAccountBaseSchema.shape.provider,
    providerUserId: SysOauthAccountBaseSchema.shape.providerUserId,
    providerLogin: SysOauthAccountBaseSchema.shape.providerLogin,
    avatar: SysOauthAccountBaseSchema.shape.avatar,
    rawProfile: SysOauthAccountBaseSchema.shape.rawProfile,
    createdBy: SysOauthAccountBaseSchema.shape.createdBy,
    createdAt: SysOauthAccountBaseSchema.shape.createdAt,
    updatedBy: SysOauthAccountBaseSchema.shape.updatedBy,
    updatedAt: SysOauthAccountBaseSchema.shape.updatedAt,
});
export type SysOauthAccountRespDTO = z.infer<typeof SysOauthAccountRespSchema>;
