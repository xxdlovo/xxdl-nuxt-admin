import z from 'zod'

/**
 * 第三方登录配置基础 Schema —— 和数据库非空保持一致, 优先使用这个
 * 用于其他 Schema 继承和复用
 */
export const SysOauthConfigBaseSchema = z.object({
    id: z.string().nullish(),
    platform: z.string().nullish(),
    platformName: z.string().nullish().meta(
        {
            query: 'like'
        }
    ),
    icon: z.string().nullish(),
    clientId: z.string().nullish().meta(
        {
            query: 'like'
        }
    ),
    clientSecret: z.string().nullish(),
    redirectUrl: z.string().nullish().meta(
        {
            query: 'like'
        }
    ),
    scope: z.string().nullish().meta(
        {
            query: 'like'
        }
    ),
    defaultRoleId: z.string().nullish(),
    status: z.number().nullish(),
    sortOrder: z.number().nullish(),
    extra: z.unknown().nullish(),
    remark: z.string().nullish().meta(
        {
            query: 'like'
        }
    ),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysOauthConfigDto = z.infer<typeof SysOauthConfigBaseSchema>
