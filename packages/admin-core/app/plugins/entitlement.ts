/**
 * `v-feature` 指令：按能力（功能开关 / 配额）控制元素显隐或禁用。
 *
 * 用法：
 * - `v-feature="'class.max'"`：能力不满足时移除元素（与 v-permission 一致）；
 * - `v-feature="['a', 'b']"`：数组表示「全部满足」才显示；
 * - `v-feature:disable="'class.max'"`：能力不满足时不移除，改为 disabled + aria-disabled + title。
 *
 * 与 `v-permission` 完全独立：各自持有 effectScope 与元素状态（不同字段名），
 * 可以叠加使用，互不覆盖。
 */
import { effectScope, watch } from 'vue'
import type { DirectiveBinding, EffectScope } from 'vue'
import { useRbacProfileStore } from '#admin/app/stores/rbacProfile'
import { isEntitlementOn } from '#admin/shared/entitlement/types'
import type { EntitlementProfile } from '#admin/shared/entitlement/types'

type FeatureValue = string | string[] | null | undefined
type FeatureMode = 'remove' | 'disable'
type FeatureElement = HTMLElement & {
  __featureScope__?: EffectScope
  __featureDisplay__?: string
  __featureTitle__?: string | null
  __featureOriginalDisabled__?: boolean
  __featureHidden__?: boolean
  __featureDisabledApplied__?: boolean
}

function normalizeFeatureValue(value: FeatureValue) {
  if (!value) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

/** 数组表示全部满足；profile 未加载或能力未登记时视为不满足（与后端 fail-closed 一致）。 */
function isFeatureAllowed(entitlements: EntitlementProfile | undefined, keys: string[]) {
  if (!entitlements) {
    return false
  }

  return keys.every(key => isEntitlementOn(entitlements, key))
}

function cleanupFeatureWatcher(el: FeatureElement) {
  el.__featureScope__?.stop()
  el.__featureScope__ = undefined
}

function isElementDisabled(el: FeatureElement) {
  return 'disabled' in el && Boolean((el as FeatureElement & { disabled?: boolean }).disabled)
}

function setElementDisabled(el: FeatureElement, disabled: boolean) {
  if ('disabled' in el) {
    (el as FeatureElement & { disabled: boolean }).disabled = disabled
    return
  }

  // 非表单元素没有 disabled 属性：仍打上标记属性，样式/测试可据此判断
  if (disabled) {
    el.setAttribute('disabled', 'disabled')
  }
  else {
    el.removeAttribute('disabled')
  }
}

/** 还原本指令改动过的 display / disabled / title；不碰应用自身设置的状态。 */
function restoreFeatureState(el: FeatureElement) {
  if (el.__featureHidden__) {
    el.style.display = el.__featureDisplay__ ?? ''
    el.__featureHidden__ = false
  }

  if (!el.__featureDisabledApplied__) {
    return
  }

  el.removeAttribute('aria-disabled')

  if (el.__featureTitle__ === null) {
    el.removeAttribute('title')
  }
  else if (el.__featureTitle__ !== undefined) {
    el.setAttribute('title', el.__featureTitle__)
  }

  setElementDisabled(el, el.__featureOriginalDisabled__ === true)
  el.__featureDisabledApplied__ = false
}

function applyFeatureDisabled(el: FeatureElement, disabled: boolean, tip: string) {
  if (!disabled) {
    restoreFeatureState(el)
    return
  }

  el.setAttribute('aria-disabled', 'true')
  el.setAttribute('title', tip)
  setElementDisabled(el, true)
  el.__featureDisabledApplied__ = true
}

export default defineNuxtPlugin((nuxtApp) => {
  function bindFeature(el: FeatureElement, binding: DirectiveBinding<FeatureValue>) {
    cleanupFeatureWatcher(el)
    restoreFeatureState(el)

    const keys = normalizeFeatureValue(binding.value)
    // 没给能力键：不约束元素（与 v-permission 的早退行为一致）
    if (keys.length === 0) {
      return
    }

    // `v-feature:disable` 的 disable 是「指令参数」（binding.arg），不是修饰符
    const mode: FeatureMode = binding.arg === 'disable' ? 'disable' : 'remove'

    el.__featureDisplay__ ??= el.style.display
    if (el.__featureTitle__ === undefined) {
      el.__featureTitle__ = el.getAttribute('title')
    }
    if (el.__featureOriginalDisabled__ === undefined) {
      el.__featureOriginalDisabled__ = isElementDisabled(el)
    }

    const rbac = useRbacProfileStore()
    const scope = effectScope()
    el.__featureScope__ = scope

    scope.run(() => {
      watch(
        () => rbac.profile,
        (profile) => {
          const allowed = isFeatureAllowed(profile?.entitlements, keys)

          if (mode === 'disable') {
            // 文案 key 由 trade 的文案波补；缺 key 时 i18n 会回退 key 本身，可接受
            applyFeatureDisabled(
              el,
              !allowed,
              nuxtApp.$ts('module.system.entitlement.disabledTip')
            )
            return
          }

          // profile 尚未加载：先隐藏，避免未授权入口闪现；加载后再决定显示或移除
          if (!profile) {
            el.style.display = 'none'
            el.__featureHidden__ = true
            return
          }

          if (allowed) {
            if (el.__featureHidden__) {
              el.style.display = el.__featureDisplay__ ?? ''
              el.__featureHidden__ = false
            }
            return
          }

          el.parentNode?.removeChild(el)
          cleanupFeatureWatcher(el)
        },
        { immediate: true }
      )
    })
  }

  nuxtApp.vueApp.directive('feature', {
    mounted: bindFeature,
    updated: bindFeature,
    unmounted: cleanupFeatureWatcher
  })
})
