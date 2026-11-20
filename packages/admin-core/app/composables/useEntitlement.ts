import { storeToRefs } from 'pinia'
import type { ComputedRef } from 'vue'
import { useRbacProfileStore } from '#admin/app/stores/rbacProfile'
import {
  isEntitlementOn,
  isUnlimited as isUnlimitedValue,
  quotaOf,
  remainingOf,
} from '#admin/shared/entitlement/types'
import type { EntitlementProfile } from '#admin/shared/entitlement/types'

/**
 * 当前用户的能力（功能开关 + 配额）读模型。
 *
 * 数据来自 `auth.profile` 返回的 `profile.entitlements`（已随 RBAC profile 一次下发），
 * 不在前端单独请求。服务端以同名字段强制校验，前端判定只用于隐藏 / 禁用入口。
 *
 * 未登录或尚未加载 profile 时：can=false、quota=0、isHidden=false，
 * 即「默认不可用」，避免未加载完成时短暂放行。
 */
export function useEntitlement(): {
  profile: ComputedRef<EntitlementProfile | null>
  levelName: ComputedRef<string | null>
  can: (key: string) => boolean
  quota: (key: string) => number
  remaining: (key: string, used: number) => number | null
  isHidden: (key: string) => boolean
  isUnlimited: (key: string) => boolean
} {
  const store = useRbacProfileStore()
  const { profile: rbacProfile } = storeToRefs(store)

  const profile = computed<EntitlementProfile | null>(() => rbacProfile.value?.entitlements ?? null)
  const levelName = computed(() => profile.value?.levelName ?? null)

  /**
   * 功能是否可用。判定与后端 assertEntitlement 完全同源（见 isEntitlementOn）：
   * switch 看 ===1；quota 看 UNLIMITED 或 >0。
   */
  function can(key: string) {
    return isEntitlementOn(profile.value, key)
  }

  /** 配额原始值：-1 表示不限；未加载 / 未登记按 0。 */
  function quota(key: string) {
    return quotaOf(profile.value?.features?.[key])
  }

  /** 剩余可用量：不限返回 null，否则 max(0, 上限 - used)。 */
  function remaining(key: string, used: number) {
    return remainingOf(quota(key), used)
  }

  /** 是否隐藏（userShow=false）：展示层据此不显示名称 / 额度，但按钮仍按 can 禁用。 */
  function isHidden(key: string) {
    return profile.value?.hiddenFeatures?.includes(key) === true
      || profile.value?.meta?.[key]?.userShow === false
  }

  function isUnlimited(key: string) {
    return isUnlimitedValue(quota(key))
  }

  return {
    profile,
    levelName,
    can,
    quota,
    remaining,
    isHidden,
    isUnlimited
  }
}
