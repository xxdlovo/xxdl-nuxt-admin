import z from 'zod'

export const SysLoginLogBaseSchema = z.object({
    id: z.string().nullish(),
    userId: z.string().nullish(),
    username: z.string().nullish().meta({ query: 'like' }),
    ip: z.string().nullish().meta({ query: 'like' }),
    location: z.string().nullish().meta({ query: 'like' }),
    browser: z.string().nullish(),
    os: z.string().nullish(),
    userAgent: z.string().nullish(),
    loginType: z.string().nullish(),
    loginTime: z.string().nullish(),
    status: z.number().nullish(),
    remark: z.string().nullish().meta({ query: 'like' }),
    errorCode: z.string().nullish().meta({ query: 'like' }),
    traceId: z.string().nullish().meta({ query: 'like' }),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysLoginLogDto = z.infer<typeof SysLoginLogBaseSchema>
