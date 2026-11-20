import z from 'zod'

/**
 * 会员功能目录（等级能力开关 / 配额）基础 Schema —— 与 `sys_member_feature` 表结构一致。
 *
 * 与 shared 其它模块的写法保持一致：所有字段统一 nullish()，便于 pick() / extend() 复用，
 * 必填与取值范围在 input.ts / Service 里收敛。
 *
 * 取值语义（与 `#admin/shared/entitlement/types` 的 entitlement 约定一致）：
 * - `kind = 'switch'`：开关，值 0 / 1；
 * - `kind = 'quota'`：配额，-1 表示不限（`UNLIMITED`），>= 0 表示额度；
 * - `defaultValue`：等级**未配置**该功能时的取值；
 * - `adminBypass`：管理员（`sys_user.is_admin = 1`）是否绕过（开关置 1 / 配额置不限）；
 * - `userShow`：是否向端用户展示；0 = 仅后端强制，用户侧不显示名称 / 额度 / 具体上限；
 * - `resolverKey`：配额已使用量的计量键，必须与后端 `registerEntitlementResolver` 注册过的键一致。
 */
export const SysMemberFeatureKindSchema = z.enum(['switch', 'quota'])
export type SysMemberFeatureKind = z.infer<typeof SysMemberFeatureKindSchema>

export const SysMemberFeatureBaseSchema = z.object({
    id: z.string().nullish(),
    /** 功能键：全局唯一，**创建后不可修改**（如 class.max / report.export） */
    featureKey: z.string().nullish().meta({ query: 'like' }),
    name: z.string().nullish().meta({ query: 'like' }),
    kind: SysMemberFeatureKindSchema.nullish(),
    /** 配额单位（如 个 / 次 / MB）；开关类可为空 */
    unit: z.string().nullish(),
    groupName: z.string().nullish().meta({ query: 'like' }),
    sortOrder: z.number().nullish(),
    /** 等级未配置时的取值：switch 用 0/1；quota 用 -1(不限) 或 >= 0 */
    defaultValue: z.number().nullish(),
    /**
     * 配额已使用量的计量器键（kind=quota 必填且必须已注册；kind=switch 必须为空）。
     * 与 featureKey 解耦：多个功能可共用一个计量器（student.max / student.export 都用 studentCount）。
     */
    resolverKey: z.string().nullish(),
    /** 管理员是否绕过：1 是 / 0 否 */
    adminBypass: z.number().nullish(),
    /** 是否向端用户展示：1 是 / 0 否 */
    userShow: z.number().nullish(),
    status: z.number().nullish(),
    createdBy: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysMemberFeatureDto = z.infer<typeof SysMemberFeatureBaseSchema>

/**
 * 功能键格式：字母开头，允许字母 / 数字 / 下划线 / 短横线 / 点（如 class.max、report_export）。
 * 用点分层是为了让键自带命名空间，避免不同业务模块撞键。
 */
export const SysMemberFeatureKeySchema = z
    .string()
    .trim()
    .min(1, 'form.required')
    .max(64, 'form.required')
    .regex(/^[A-Za-z][A-Za-z0-9_.-]*$/, 'module.system.memberFeature.featureKeyInvalid')
