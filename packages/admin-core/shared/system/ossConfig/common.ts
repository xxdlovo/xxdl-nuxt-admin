import z from 'zod'

export const SysOssConfigBaseSchema = z.object({
    id: z.string().nullish(),
    configKey: z.string().nullish().meta({ query: 'like' }),
    configName: z.string().nullish().meta({ query: 'like' }),
    service: z.string().nullish(),
    endpoint: z.string().nullish().meta({ query: 'like' }),
    region: z.string().nullish(),
    bucketName: z.string().nullish().meta({ query: 'like' }),
    accessKey: z.string().nullish(),
    secretKey: z.string().nullish(),
    domain: z.string().nullish().meta({ query: 'like' }),
    prefix: z.string().nullish(),
    isHttps: z.number().nullish(),
    accessPolicy: z.number().nullish(),
    isDefault: z.number().nullish(),
    verifyStatus: z.number().nullish(),
    verifyTime: z.string().nullish(),
    verifyMessage: z.string().nullish().meta({ query: 'like' }),
    status: z.number().nullish(),
    remark: z.string().nullish().meta({ query: 'like' }),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysOssConfigDto = z.infer<typeof SysOssConfigBaseSchema>
