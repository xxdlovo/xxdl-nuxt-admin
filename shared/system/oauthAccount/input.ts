import { SysOauthAccountBaseSchema } from './common'
import { z } from 'zod'
import { ApiRequestSchema } from '#shared/types/common'

// add —— userId / provider / providerUserId 在库中为 NOT NULL，必须覆盖为必填
export const SysOauthAccountAddSchema =
    SysOauthAccountBaseSchema.pick({
        userId: true,
        provider: true,
        providerUserId: true,
        providerLogin: true,
        avatar: true,
        rawProfile: true,
    }).extend({
        id: SysOauthAccountBaseSchema.shape.id.nonoptional(),
        userId: z.string().min(1, 'form.required').max(36, 'form.required'),
        provider: z.string().min(1, 'form.required').max(20, 'form.required'),
        providerUserId: z.string().min(1, 'form.required').max(64, 'form.required'),
    })
export type SysOauthAccountAddDTO = z.infer<typeof SysOauthAccountAddSchema>;

// update
export const SysOauthAccountUpdateSchema = SysOauthAccountAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysOauthAccountUpdateDTO = z.infer<typeof SysOauthAccountUpdateSchema>;

// query
export const SysOauthAccountQuerySchema = SysOauthAccountBaseSchema.pick({
    id: true,
    userId: true,
    provider: true,
    providerUserId: true,
    providerLogin: true,
})
export type SysOauthAccountQueryDTO = z.infer<typeof SysOauthAccountQuerySchema>;

// page query
export const SysOauthAccountPageQuerySchema =
    SysOauthAccountBaseSchema.pick({
        id: true,
        userId: true,
        provider: true,
        providerUserId: true,
        providerLogin: true,
    }).extend(ApiRequestSchema.shape)
export type SysOauthAccountPageQueryDTO = z.infer<typeof SysOauthAccountPageQuerySchema>;
