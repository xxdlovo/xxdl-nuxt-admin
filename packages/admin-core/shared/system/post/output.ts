import { z } from 'zod'
import { SysPostBaseSchema } from './common'
import { TrpcPageResponseSchema } from '#admin/shared/types/common'

export const SysPostRespSchema = z.object({
    id: SysPostBaseSchema.shape.id,
    code: SysPostBaseSchema.shape.code,
    name: SysPostBaseSchema.shape.name,
    sortOrder: SysPostBaseSchema.shape.sortOrder,
    status: SysPostBaseSchema.shape.status,
    remark: SysPostBaseSchema.shape.remark,
    createdAt: SysPostBaseSchema.shape.createdAt,
})

export type SysPostRespDTO = z.infer<typeof SysPostRespSchema>

export const SysPostPageRespSchema = TrpcPageResponseSchema(SysPostRespSchema)
export type SysPostPageRespDTO = z.infer<typeof SysPostPageRespSchema>
