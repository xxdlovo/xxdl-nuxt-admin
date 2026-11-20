import { z } from 'zod'
import { SysMemberFeatureBaseSchema, SysMemberFeatureKindSchema } from './common'

/** 功能目录响应：列表 / 详情 / 表单回显共用（不含审计字段 createdBy / updatedBy） */
export const SysMemberFeatureRespSchema = z.object({
    id: SysMemberFeatureBaseSchema.shape.id,
    featureKey: SysMemberFeatureBaseSchema.shape.featureKey,
    name: SysMemberFeatureBaseSchema.shape.name,
    kind: SysMemberFeatureBaseSchema.shape.kind,
    unit: SysMemberFeatureBaseSchema.shape.unit,
    groupName: SysMemberFeatureBaseSchema.shape.groupName,
    sortOrder: SysMemberFeatureBaseSchema.shape.sortOrder,
    defaultValue: SysMemberFeatureBaseSchema.shape.defaultValue,
    resolverKey: SysMemberFeatureBaseSchema.shape.resolverKey,
    adminBypass: SysMemberFeatureBaseSchema.shape.adminBypass,
    userShow: SysMemberFeatureBaseSchema.shape.userShow,
    status: SysMemberFeatureBaseSchema.shape.status,
    createdAt: SysMemberFeatureBaseSchema.shape.createdAt,
    updatedAt: SysMemberFeatureBaseSchema.shape.updatedAt,
})
export type SysMemberFeatureRespDTO = z.infer<typeof SysMemberFeatureRespSchema>

/**
 * 等级能力矩阵的一行：**功能元数据 + 该等级的取值**。
 *
 * 一次带出元数据是为了让等级页的能力矩阵弹窗只发一次请求：
 * 前端不必再分别拉功能目录与等级矩阵，也不会出现「目录里有、矩阵里没有」的拼接错位。
 * `value` 是「已配置值优先、否则目录默认值」的最终值（与 entitlementSource 的合并口径一致）。
 */
export const SysMemberLevelFeatureMatrixItemSchema = z.object({
    featureKey: z.string(),
    value: z.number().int(),
    name: z.string(),
    kind: SysMemberFeatureKindSchema,
    /** 配额单位；开关类为空 */
    unit: z.string().nullish(),
    groupName: z.string().nullish(),
    sortOrder: z.number().int().nullish(),
    /** 配额已使用量计量键；开关类为空 */
    resolverKey: z.string().nullish(),
    /** 等级未配置时的取值 */
    defaultValue: z.number().int(),
    /** 是否向端用户展示：1 是 / 0 否 */
    userShow: z.number().int(),
    /** 管理员是否绕过：1 是 / 0 否 */
    adminBypass: z.number().int(),
})
export type SysMemberLevelFeatureMatrixItemDTO = z.infer<typeof SysMemberLevelFeatureMatrixItemSchema>

/** 等级能力矩阵响应：某个等级 × **全部启用功能**（含元数据） */
export const SysMemberLevelFeatureMatrixSchema = z.object({
    levelId: z.string(),
    items: z.array(SysMemberLevelFeatureMatrixItemSchema),
})
export type SysMemberLevelFeatureMatrixDTO = z.infer<typeof SysMemberLevelFeatureMatrixSchema>

/**
 * 保存等级能力矩阵：**整体覆盖**语义。
 *
 * 传进来的 `values` 就是该等级最终的全部配置：
 * - 未出现在 `values` 里的功能键会被移除（回落为目录默认值）；
 * - 传 `[]` 表示清空该等级的全部显式配置。
 * 取值校验（switch 0/1、quota -1 或 >= 0）在 Service 层做。
 */
export const SysMemberLevelSaveFeaturesSchema = z.object({
    levelId: z.string().nonempty('form.id.required').max(36, 'form.id.required'),
    values: z.array(z.object({
        featureKey: z.string().nonempty('form.required').max(64, 'form.required'),
        value: z.number().int(),
    })).max(200, 'module.system.memberFeature.matrixTooLarge'),
})
export type SysMemberLevelSaveFeaturesDTO = z.infer<typeof SysMemberLevelSaveFeaturesSchema>

/**
 * 我的能力画像（自助接口 `sysMember.myEntitlements` 的响应）。
 *
 * 形状与 core 的 `EntitlementProfile` **逐字段一致**（levelId / levelName / features /
 * hiddenFeatures / meta）：服务端守卫、数据源与自助接口共用同一份结构，
 * 前端拿到的就是守卫看到的，不存在「页面显示有、实际调用被拒」的偏差。
 *
 * `features` 的取值：开关 0/1；配额 -1 表示不限，>= 0 表示额度。
 * `hiddenFeatures` 列出 `userShow = 0` 的键 —— 名字都不可展示，额度与上限同样不要渲染。
 */
export const SysMyEntitlementMetaSchema = z.object({
    name: z.string(),
    kind: SysMemberFeatureKindSchema,
    userShow: z.boolean(),
    unit: z.string().nullish(),
    /**
     * 配额计量器键（可空）。由服务端数据源从目录 `resolver_key` 带出，
     * 与 `EntitlementMeta.resolverKey` 一致 —— 服务端守卫按 `resolverKey ?? 功能键` 找计量器。
     */
    resolverKey: z.string().nullish(),
    adminBypass: z.boolean().nullish(),
})
export type SysMyEntitlementMetaDTO = z.infer<typeof SysMyEntitlementMetaSchema>

export const SysMyEntitlementRespSchema = z.object({
    levelId: z.string().nullish(),
    levelName: z.string().nullish(),
    features: z.record(z.string(), z.number()),
    hiddenFeatures: z.array(z.string()),
    meta: z.record(z.string(), SysMyEntitlementMetaSchema),
})
export type SysMyEntitlementRespDTO = z.infer<typeof SysMyEntitlementRespSchema>
