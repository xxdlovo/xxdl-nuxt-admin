import type { RbacProfile } from '#shared/auth'

const RBAC_PROFILE_STATE_KEY = 'auth:rbac-profile'
const RBAC_PROFILE_LOADING_STATE_KEY = 'auth:rbac-profile-loading'
const RBAC_PROFILE_ERROR_STATE_KEY = 'auth:rbac-profile-error'

/**
 * Share the current user's RBAC profile across app modules.
 * The profile comes from auth.profile and contains roles, permission codes and menu tree.
 */
export function useRbacProfile() {
  const profile = useState<RbacProfile | null>(RBAC_PROFILE_STATE_KEY, () => null)
  const loading = useState<boolean>(RBAC_PROFILE_LOADING_STATE_KEY, () => false)
  const error = useState<Error | null>(RBAC_PROFILE_ERROR_STATE_KEY, () => null)
  const { $trpc } = useNuxtApp()

  /**
   * Load the RBAC profile once by default; pass force=true after permission changes.
   */
  async function loadProfile(force = false) {
    if (profile.value && !force) {
      return profile.value
    }

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

  return {
    profile,
    loading,
    error,
    loadProfile,
    clearProfile
  }
}
