import z from 'zod'

/**
 * 第三方登录绑定基础 Schema —— 与数据库非空保持一致，优先使用这个
 * 用于其他 Schema 继承和复用
 */
export const SysOauthAccountBaseSchema = z.object({
    id: z.string().nullish(),
    userId: z.string().nullish(),
    provider: z.string().nullish(),
    providerUserId: z.string().nullish().meta(
        {
            query: 'like'
        }
    ),
    providerLogin: z.string().nullish().meta(
        {
            query: 'like'
        }
    ),
    avatar: z.string().nullish(),
    rawProfile: z.string().nullish(),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysOauthAccountDto = z.infer<typeof SysOauthAccountBaseSchema>
