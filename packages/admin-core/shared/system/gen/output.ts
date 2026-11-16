import { z } from 'zod'

export const GenFileSchema = z.object({
    path: z.string(),
    content: z.string(),
    language: z.string().optional(),
})
export type GenFile = z.infer<typeof GenFileSchema>

export const GenPreviewRespSchema = z.object({
    files: z.array(GenFileSchema),
})
export type GenPreviewResp = z.infer<typeof GenPreviewRespSchema>
