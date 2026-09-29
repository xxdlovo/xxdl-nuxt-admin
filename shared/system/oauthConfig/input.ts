import { SysOauthConfigBaseSchema } from './common'
import { z } from 'zod'
import { ApiRequestSchema } from '#shared/types/common'

// add —— platform / platformName 在库中为 NOT NULL，必须覆盖为必填
export const SysOauthConfigAddSchema =
    SysOauthConfigBaseSchema.pick({
        platform: true,
        platformName: true,
        icon: true,
        clientId: true,
        clientSecret: true,
        redirectUrl: true,
        scope: true,
        defaultRoleId: true,
        status: true,
        sortOrder: true,
        extra: true,
        remark: true,
    }).extend({
        id: SysOauthConfigBaseSchema.shape.id.nonoptional(),
        platform: z.string().min(1, 'form.required').max(20, 'form.required'),
        platformName: z.string().min(1, 'form.required').max(50, 'form.required'),
    })
export type SysOauthConfigAddDTO = z.infer<typeof SysOauthConfigAddSchema>;

// update
export const SysOauthConfigUpdateSchema = SysOauthConfigAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysOauthConfigUpdateDTO = z.infer<typeof SysOauthConfigUpdateSchema>;

// query
export const SysOauthConfigQuerySchema = SysOauthConfigBaseSchema.pick({
    id: true,
    platform: true,
    platformName: true,
    clientId: true,
    redirectUrl: true,
    scope: true,
    defaultRoleId: true,
    status: true,
    remark: true,
})
export type SysOauthConfigQueryDTO = z.infer<typeof SysOauthConfigQuerySchema>;

// page query
export const SysOauthConfigPageQuerySchema =
    SysOauthConfigBaseSchema.pick({
        id: true,
        platform: true,
        platformName: true,
        clientId: true,
        redirectUrl: true,
        scope: true,
        defaultRoleId: true,
        status: true,
        remark: true,
    }).extend(ApiRequestSchema.shape)
export type SysOauthConfigPageQueryDTO = z.infer<typeof SysOauthConfigPageQuerySchema>;
