import { SysNoticeBaseSchema } from './common'
import { z } from 'zod'

export const SysNoticeRespSchema = z.object({
    id: SysNoticeBaseSchema.shape.id,
    title: SysNoticeBaseSchema.shape.title,
    summary: SysNoticeBaseSchema.shape.summary,
    content: SysNoticeBaseSchema.shape.content,
    contentFormat: SysNoticeBaseSchema.shape.contentFormat,
    noticeType: SysNoticeBaseSchema.shape.noticeType,
    topFlag: SysNoticeBaseSchema.shape.topFlag,
    publishStatus: SysNoticeBaseSchema.shape.publishStatus,
    publishTime: SysNoticeBaseSchema.shape.publishTime,
    sortOrder: SysNoticeBaseSchema.shape.sortOrder,
    remark: SysNoticeBaseSchema.shape.remark,
})
export type SysNoticeRespDTO = z.infer<typeof SysNoticeRespSchema>
