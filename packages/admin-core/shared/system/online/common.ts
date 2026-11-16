import z from 'zod'

/**
 * 在线会话基础字段。
 *
 * 只暴露管理端需要的信息，不返回 session Cookie / userAgent 等敏感或过长内容。
 */
export const SysOnlineSessionBaseSchema = z.object({
    id: z.string().nullish(),
    userId: z.string().nullish(),
    username: z.string().nullish().meta({ query: 'like' }),
    ip: z.string().nullish().meta({ query: 'like' }),
    browser: z.string().nullish(),
    os: z.string().nullish(),
    loginAt: z.string().nullish(),
    lastSeenAt: z.string().nullish(),
    expiresAt: z.string().nullish(),
})

export type SysOnlineSessionDto = z.infer<typeof SysOnlineSessionBaseSchema>
