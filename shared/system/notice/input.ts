import { SysNoticeBaseSchema } from './common'
import { z } from 'zod'
import { ApiRequestSchema } from '#shared/types/common'

export const SysNoticeAddSchema =
    SysNoticeBaseSchema.pick({
        title: true,
        summary: true,
        content: true,
        contentFormat: true,
        noticeType: true,
        topFlag: true,
        publishStatus: true,
        publishTime: true,
        sortOrder: true,
        remark: true,
    }).extend({
        id: SysNoticeBaseSchema.shape.id.nonoptional(),
        title: z.string().min(1, 'form.required'),
        contentFormat: z.enum(['html', 'md']).default('html'),
        noticeType: z.number().default(1),
        topFlag: z.number().default(0),
        publishStatus: z.number().default(1),
    })
export type SysNoticeAddDTO = z.infer<typeof SysNoticeAddSchema>

export const SysNoticeUpdateSchema = SysNoticeAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysNoticeUpdateDTO = z.infer<typeof SysNoticeUpdateSchema>

export const SysNoticePublishStatusSchema = z.object({
    id: z.string().nonempty('form.id.required'),
    publishStatus: z.union([z.literal(1), z.literal(2)])
})
export type SysNoticePublishStatusDTO = z.infer<typeof SysNoticePublishStatusSchema>

export const SysNoticeQuerySchema = SysNoticeBaseSchema.pick({
    id: true,
    title: true,
    summary: true,
    contentFormat: true,
    noticeType: true,
    topFlag: true,
    publishStatus: true,
    remark: true,
})
export type SysNoticeQueryDTO = z.infer<typeof SysNoticeQuerySchema>

export const SysNoticePageQuerySchema =
    SysNoticeQuerySchema.extend(ApiRequestSchema.shape)
export type SysNoticePageQueryDTO = z.infer<typeof SysNoticePageQuerySchema>
