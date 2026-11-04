import z from 'zod'

export const SysOssBaseSchema = z.object({
    id: z.string().nullish(),
    configId: z.string().nullish(),
    fileName: z.string().nullish().meta({ query: 'like' }),
    originalName: z.string().nullish().meta({ query: 'like' }),
    fileSuffix: z.string().nullish(),
    fileSize: z.number().nullish(),
    contentType: z.string().nullish(),
    bucketName: z.string().nullish().meta({ query: 'like' }),
    objectName: z.string().nullish().meta({ query: 'like' }),
    url: z.string().nullish(),
    md5: z.string().nullish(),
    etag: z.string().nullish(),
    service: z.string().nullish(),
    uploadUserId: z.string().nullish(),
    status: z.number().nullish(),
    remark: z.string().nullish().meta({ query: 'like' }),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysOssDto = z.infer<typeof SysOssBaseSchema>
