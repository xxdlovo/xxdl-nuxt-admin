/**
 * 功能开关与配额（entitlement）的通用类型与纯函数。
 *
 * 基座只认识「能力键 → 数值」这张扁平表，不认识会员、套餐、订阅等业务体系：
 * - 开关（switch）：数值 1 表示开启，其余（含缺失）一律视为关闭；
 * - 配额（quota）：数值即上限，UNLIMITED 表示不限，其余按「已用 + 本次增量 > 上限」判定。
 *
 * 具体数值与能力目录（meta）由上层数据源提供，见 server/utils/entitlementSource.ts。
 * 前后端共用本文件，保证展示判定与后端强制口径一致。
 */

export type EntitlementKind = 'switch' | 'quota'

/** 配额「不限」的哨兵值 */
export const UNLIMITED = -1

export type EntitlementMap = Record<string, number>

export type EntitlementMeta = {
  name: string
  kind: EntitlementKind
  /** 是否向端用户展示（false = 仅后端强制，用户侧不显示名称/额度/提示具体上限） */
  userShow: boolean
  unit?: string | null
  /**
   * 配额已使用量的计量器键；未填时回退用功能键本身。
   *
   * 允许多个功能共用一个计量器（如 `student.max` 与 `student.export` 都按
   * `studentCount` 统计），因此不能假设 resolverKey === 功能键。
   * switch 类型忽略该字段；只有 assertEntitlement 的 quota 分支读取。
   */
  resolverKey?: string | null
  /**
   * 管理员是否绕过该能力的校验，默认 true（不填即绕过）。
   *
   * 少数「管理员也必须受限」的能力（如平台级资源总量）可显式置 false。
   * 该字段只影响后端 assertEntitlement，不影响前端展示。
   */
  adminBypass?: boolean
}

export type EntitlementProfile = {
  levelId: string | null
  levelName: string | null
  features: EntitlementMap
  /** userShow=false 的功能键，供展示层过滤（不要从 features 里剔除，前端仍需据此禁用按钮） */
  hiddenFeatures: string[]
  meta: Record<string, EntitlementMeta>
}

/**
 * 「没有能力体系」时的空档案：不登记任何能力键。
 *
 * 只作为默认数据源与兜底返回值使用，调用方不要往这个对象上写数据。
 */
export const EMPTY_ENTITLEMENT_PROFILE: EntitlementProfile = {
  levelId: null,
  levelName: null,
  features: {},
  hiddenFeatures: [],
  meta: {}
}

/** 开关是否开启：只有明确的 1 算开启（与数据库 tinyint 口径一致）。 */
export function isSwitchOn(value: number | null | undefined): boolean {
  return value === 1
}

/** 读取配额原始值：缺失按 0 处理，避免调用方到处写 `?? 0`。 */
export function quotaOf(value: number | null | undefined): number {
  return value ?? 0
}

/** 配额是否不限。 */
export function isUnlimited(value: number | null | undefined): boolean {
  return value === UNLIMITED
}

/**
 * 剩余可用量：不限返回 null（调用方据此显示「不限」而不是数字），
 * 否则返回不小于 0 的剩余数。
 */
export function remainingOf(limit: number, used: number): number | null {
  return isUnlimited(limit) ? null : Math.max(0, limit - used)
}

/**
 * 纯函数版配额判定：还能否再创建 delta 个。
 * 缺失上限按 0 处理（fail-closed），与后端 assertEntitlement 对齐。
 */
export function canCreate(limit: number | null | undefined, used: number, delta = 1): boolean {
  const value = quotaOf(limit)

  return isUnlimited(value) || used + delta <= value
}

/**
 * 前端能力判定：与后端 assertEntitlement 的 switch / quota 口径保持一致。
 *
 * - switch：值 === 1；
 * - quota：UNLIMITED 或 > 0（仅表示「还有额度」，剩余量用 remainingOf 展示）；
 * - profile 缺失或能力未在 meta 登记：false（后端对这些情况 fail-closed）。
 */
export function isEntitlementOn(profile: EntitlementProfile | null | undefined, key: string): boolean {
  const meta = profile?.meta?.[key]
  const value = profile?.features?.[key]

  if (!meta) {
    return false
  }

  return meta.kind === 'quota'
    ? isUnlimited(value) || quotaOf(value) > 0
    : isSwitchOn(value)
}
