import { z } from 'zod'
import { SysMemberFeatureBaseSchema, SysMemberFeatureKeySchema, SysMemberFeatureKindSchema } from './common'
import { ApiRequestSchema } from '#admin/shared/types/common'

/**
 * 新增功能。
 *
 * 注意 `defaultValue` 不在这里给默认值：switch 的合理默认是 1、quota 的合理默认是 0，
 * 由 Service 按 `kind` 兜底（见 SysMemberFeatureService.create），避免「配额默认 1」这种怪配置。
 * `kind=quota` 的 resolverKey 必填、`kind=switch` 必须为空，也在 Service 里校验
 * （需要读「已注册计量键」清单，Schema 层拿不到）。
 */
export const SysMemberFeatureAddSchema = SysMemberFeatureBaseSchema.pick({
    name: true,
    kind: true,
    unit: true,
    groupName: true,
    sortOrder: true,
    defaultValue: true,
    resolverKey: true,
    adminBypass: true,
    userShow: true,
    status: true,
}).extend({
    /** 功能键：全局唯一，创建后不可修改 */
    featureKey: SysMemberFeatureKeySchema,
    name: z.string().trim().min(1, 'form.required').max(50, 'form.required'),
    kind: SysMemberFeatureKindSchema.default('switch'),
    unit: z.string().trim().max(20).nullish(),
    groupName: z.string().trim().max(50).nullish(),
    sortOrder: z.number().int().default(0),
    /** switch 只允许 0/1；quota 允许 -1(不限) 或 >= 0 —— 由 Service 校验 */
    defaultValue: z.number().int().optional(),
    /** 配额计量器键：kind=quota 必填且必须已注册（可与 featureKey 不同）；kind=switch 必须为空 */
    resolverKey: z.string().trim().max(64).nullish(),
    adminBypass: z.number().int().min(0).max(1).default(1),
    userShow: z.number().int().min(0).max(1).default(1),
    status: z.number().default(1),
})
export type SysMemberFeatureAddDTO = z.infer<typeof SysMemberFeatureAddSchema>

/**
 * 修改功能。
 *
 * **`featureKey` 创建后禁止修改**：这里仍保留一个可选的 `featureKey`，
 * 但只用于「把修改请求里的 featureKey 显式拒绝掉」（Service 比对后抛
 * `module.system.memberFeature.featureKeyImmutable`）——直接剔除字段会让前端的
 * 误提交静默成功，反而更难排查。除 id 外其余字段都可选，未传即保持原值。
 */
export const SysMemberFeatureUpdateSchema = SysMemberFeatureBaseSchema.pick({
    name: true,
    kind: true,
    unit: true,
    groupName: true,
    sortOrder: true,
    defaultValue: true,
    resolverKey: true,
    adminBypass: true,
    userShow: true,
    status: true,
}).extend({
    id: z.string().nonempty('form.id.required'),
    /** 仅用于拒绝修改；与现有值相同则忽略 */
    featureKey: SysMemberFeatureKeySchema.optional(),
})
export type SysMemberFeatureUpdateDTO = z.infer<typeof SysMemberFeatureUpdateSchema>

// 查询条件（列表页筛选：功能键 / 名称 / 分组 / 类型 / 状态）
export const SysMemberFeatureQuerySchema = SysMemberFeatureBaseSchema.pick({
    id: true,
    featureKey: true,
    name: true,
    kind: true,
    groupName: true,
    status: true,
})
export type SysMemberFeatureQueryDTO = z.infer<typeof SysMemberFeatureQuerySchema>

// 分页查询：查询条件 + 分页参数
export const SysMemberFeaturePageQuerySchema =
    SysMemberFeatureQuerySchema.extend(ApiRequestSchema.shape)
export type SysMemberFeaturePageQueryDTO = z.infer<typeof SysMemberFeaturePageQuerySchema>
