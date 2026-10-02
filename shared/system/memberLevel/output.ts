import { z } from 'zod'
import { SysMemberLevelBaseSchema } from './common'

/** 会员等级响应：与列表 / 表单展示字段一一对应 */
export const SysMemberLevelRespSchema = z.object({
    id: SysMemberLevelBaseSchema.shape.id,
    code: SysMemberLevelBaseSchema.shape.code,
    name: SysMemberLevelBaseSchema.shape.name,
    sortOrder: SysMemberLevelBaseSchema.shape.sortOrder,
    benefit: SysMemberLevelBaseSchema.shape.benefit,
    status: SysMemberLevelBaseSchema.shape.status,
    remark: SysMemberLevelBaseSchema.shape.remark,
    createdAt: SysMemberLevelBaseSchema.shape.createdAt,
    updatedAt: SysMemberLevelBaseSchema.shape.updatedAt,
})
export type SysMemberLevelRespDTO = z.infer<typeof SysMemberLevelRespSchema>
