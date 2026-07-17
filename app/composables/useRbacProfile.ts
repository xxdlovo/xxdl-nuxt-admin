import { storeToRefs } from 'pinia'
import { useRbacProfileStore } from '~/stores/rbacProfile'

/**
 * Share the current user's RBAC profile across app modules.
 * The profile comes from auth.profile and contains roles, permission codes and menu tree.
 */
export function useRbacProfile() {
  const store = useRbacProfileStore()
  const { profile, loading, error } = storeToRefs(store)
  const isAdmin = computed(() => profile.value?.user.isAdmin === 1)

  return {
    profile,
    loading,
    error,
    isAdmin,
    loadProfile: store.loadProfile,
    clearProfile: store.clearProfile,
    hasPermission: store.hasPermission,
    hasAnyPermission: store.hasAnyPermission,
    hasAllPermissions: store.hasAllPermissions
  }
}
