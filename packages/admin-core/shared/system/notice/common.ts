import z from 'zod'

export const SysNoticeBaseSchema = z.object({
    id: z.string().nullish(),
    title: z.string().nullish().meta({ query: 'like' }),
    summary: z.string().nullish().meta({ query: 'like' }),
    content: z.string().nullish(),
    contentFormat: z.string().nullish(),
    noticeType: z.number().nullish(),
    topFlag: z.number().nullish(),
    publishStatus: z.number().nullish(),
    publishTime: z.string().nullish(),
    sortOrder: z.number().nullish(),
    remark: z.string().nullish().meta({ query: 'like' }),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysNoticeDto = z.infer<typeof SysNoticeBaseSchema>
