import { defineStore } from 'pinia'
import type { RbacProfile } from '#shared/auth'

/**
 * Stores the current user's RBAC read model for menus and permission checks.
 */
export const useRbacProfileStore = defineStore('rbacProfile', () => {
  const profile = ref<RbacProfile | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const permissionSet = computed(() => new Set(profile.value?.permissions ?? []))

  /**
   * Load the RBAC profile once by default; pass force=true after permission changes.
   */
  async function loadProfile(force = false) {
    if (profile.value && !force) {
      return profile.value
    }

    const { $trpc } = useNuxtApp()

    loading.value = true
    error.value = null

    try {
      const result = await $trpc.auth.profile.query()
      profile.value = result
      return result
    } catch (err) {
      error.value = err as Error
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear cached RBAC data when the user logs out or switches accounts.
   */
  function clearProfile() {
    profile.value = null
    error.value = null
    loading.value = false
  }

  /**
   * Check whether the current user owns one permission code.
   */
  function hasPermission(code: string) {
    return permissionSet.value.has(code)
  }

  /**
   * Check whether the current user owns at least one of the provided permission codes.
   */
  function hasAnyPermission(codes: string[]) {
    return codes.some(code => hasPermission(code))
  }

  /**
   * Check whether the current user owns all provided permission codes.
   */
  function hasAllPermissions(codes: string[]) {
    return codes.every(code => hasPermission(code))
  }

  return {
    profile,
    loading,
    error,
    loadProfile,
    clearProfile,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
  }
})
