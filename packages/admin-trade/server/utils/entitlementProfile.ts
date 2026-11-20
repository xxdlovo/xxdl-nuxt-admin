/**
 * entitlement 档案的**纯函数**组装（无 IO、无缓存、无 DB）。
 *
 * 与 `entitlementSource.ts` 分开是为了让「目录 → 矩阵 → 默认值 → 管理员绕过 → 隐藏项」
 * 这段合并规则可以被单独推理与执行：`entitlementSource` 只负责取数（档案 / 等级 / 缓存），
 * 合并口径集中在这里，避免后台能力矩阵、自助接口与服务端守卫各写一份。
 *
 * 取值规则：
 * - 显式配置优先：`value = 矩阵行?.value ?? 目录 default_value`；
 * - 目录默认值缺失时按类型兜底：开关 1（默认开）、配额 0（默认无额度）；
 * - 管理员绕过：`isAdmin && admin_bypass=1` → 开关置 1、配额置 `UNLIMITED`；
 * - `meta.resolverKey` 必须如实带上：基座 `assertEntitlement` 用
 *   `meta.resolverKey ?? 功能键` 去查配额计量器，漏填会让「共用计量器」的功能永远 403。
 */
import { UNLIMITED } from '#admin/shared/entitlement/types'
import type { EntitlementMeta, EntitlementProfile } from '#admin/shared/entitlement/types'

/**
 * 目录行中参与解析的最小字段集（`SysMemberFeatureRow` 结构上兼容它）。
 * 单独声明是为了让本文件的输入不依赖 drizzle 的行类型。
 */
export type EntitlementCatalogRow = {
  featureKey: string
  name: string
  kind: string | null
  unit: string | null
  defaultValue: number | null
  resolverKey: string | null
  adminBypass: number | null
  userShow: number | null
}

/** 已解析的会员等级（没有档案 / 等级已删时为 null） */
export type EntitlementLevelRef = { id: string, name: string } | null

export function buildEntitlementProfile(input: {
  catalog: EntitlementCatalogRow[]
  /** 该等级显式配置的「功能键 → 值」；没有等级时传空对象 */
  matrix: Record<string, number>
  level: EntitlementLevelRef
  isAdmin: boolean
}): EntitlementProfile {
  const features: Record<string, number> = {}
  const meta: Record<string, EntitlementMeta> = {}
  const hiddenFeatures: string[] = []

  for (const row of input.catalog) {
    const kind: EntitlementMeta['kind'] = row.kind === 'quota' ? 'quota' : 'switch'
    const stored = input.matrix[row.featureKey]
    let value = typeof stored === 'number'
      ? stored
      : Number(row.defaultValue ?? (kind === 'switch' ? 1 : 0))

    const adminBypass = Number(row.adminBypass ?? 0) === 1

    if (input.isAdmin && adminBypass) {
      // 开关置 1、配额置不限；meta.adminBypass 一并带上，前端/admin 都能解释这个值从哪来
      value = kind === 'switch' ? 1 : UNLIMITED
    }

    const userShow = Number(row.userShow ?? 1) === 1

    features[row.featureKey] = value

    if (!userShow) {
      hiddenFeatures.push(row.featureKey)
    }

    meta[row.featureKey] = {
      name: row.name,
      kind,
      userShow,
      unit: row.unit ?? null,
      /**
       * 配额计量器键（可空）。**必须**带上：基座守卫读的是 `meta.resolverKey ?? 功能键`，
       * 多个功能可以共用一个计量器（student.max / student.export 都按 studentCount 统计），
       * 漏这个字段会让这类功能的配额校验永远找不到计量器（403）。
       * switch 类型忽略该字段（保存时已强制为空）。
       */
      resolverKey: row.resolverKey ?? null,
      adminBypass
    }
  }

  return {
    levelId: input.level?.id ?? null,
    levelName: input.level?.name ?? null,
    features,
    hiddenFeatures,
    meta
  }
}
