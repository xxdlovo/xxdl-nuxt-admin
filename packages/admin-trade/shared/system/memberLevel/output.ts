import { z } from 'zod'
import { SysMemberLevelBaseSchema } from './common'

/** 会员等级响应：与列表 / 表单展示字段一一对应 */
export const SysMemberLevelRespSchema = z.object({
    id: SysMemberLevelBaseSchema.shape.id,
    code: SysMemberLevelBaseSchema.shape.code,
    name: SysMemberLevelBaseSchema.shape.name,
    sortOrder: SysMemberLevelBaseSchema.shape.sortOrder,
    benefit: SysMemberLevelBaseSchema.shape.benefit,
    price: SysMemberLevelBaseSchema.shape.price,
    durationDays: SysMemberLevelBaseSchema.shape.durationDays,
    isDefault: SysMemberLevelBaseSchema.shape.isDefault,
    isLongTerm: SysMemberLevelBaseSchema.shape.isLongTerm,
    status: SysMemberLevelBaseSchema.shape.status,
    remark: SysMemberLevelBaseSchema.shape.remark,
    createdAt: SysMemberLevelBaseSchema.shape.createdAt,
    updatedAt: SysMemberLevelBaseSchema.shape.updatedAt,
    /**
     * 该等级**已显式配置**的能力项数（sys_member_level_feature 里未删除的行数）。
     * 只由列表 / 分页 Service 回填；未查询时为 null（前端据此显示「未配置」而不是 0 项）。
     */
    featureCount: z.number().nullish(),
})
export type SysMemberLevelRespDTO = z.infer<typeof SysMemberLevelRespSchema>
