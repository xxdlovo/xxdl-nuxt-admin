import { effectScope, watch } from 'vue'
import type { DirectiveBinding, EffectScope } from 'vue'
import { useRbacProfileStore } from '~/stores/rbacProfile'

type PermissionValue = string | string[] | null | undefined
type PermissionElement = HTMLElement & {
  __permissionScope__?: EffectScope
  __permissionDisplay__?: string
}

function normalizePermissionValue(value: PermissionValue) {
  if (!value) {
    return []
  }

  return Array.isArray(value) ? value : [value]
}

function cleanupPermissionWatcher(el: PermissionElement) {
  el.__permissionScope__?.stop()
  el.__permissionScope__ = undefined
}

function bindPermission(el: PermissionElement, binding: DirectiveBinding<PermissionValue>) {
  cleanupPermissionWatcher(el)

  const codes = normalizePermissionValue(binding.value)
  if (codes.length === 0) {
    return
  }

  const rbac = useRbacProfileStore()
  el.__permissionDisplay__ ??= el.style.display

  const scope = effectScope()
  el.__permissionScope__ = scope

  scope.run(() => {
    watch(
      () => rbac.profile,
      (profile) => {
        if (!profile) {
          el.style.display = 'none'
          return
        }

        if (profile.user.isAdmin === 1 || rbac.hasAnyPermission(codes)) {
          el.style.display = el.__permissionDisplay__ ?? ''
          return
        }

        el.parentNode?.removeChild(el)
        cleanupPermissionWatcher(el)
      },
      { immediate: true }
    )
  })
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('permission', {
    mounted: bindPermission,
    updated: bindPermission,
    unmounted: cleanupPermissionWatcher
  })
})
