/** 字典缓存默认有效期：字典更新频率低，且写入口会主动失效。 */
export const DICT_CACHE_TTL_SECONDS = 30 * 60
/** RBAC 缓存默认有效期：主动失效负责及时更新，TTL 负责兜底。 */
export const RBAC_CACHE_TTL_SECONDS = 15 * 60

export const DICT_CACHE_PREFIX = 'dict:'
export const RBAC_USER_CACHE_PREFIX = 'rbac:user:'
export const RBAC_ROLE_CACHE_PREFIX = 'rbac:role:'
export const RBAC_ADMIN_CACHE_KEY = 'rbac:admin:menu-list'

export function dictCacheKey(code: string) {
  return `${DICT_CACHE_PREFIX}${encodeURIComponent(code)}`
}

export function userRolesCacheKey(userId: string) {
  return `${RBAC_USER_CACHE_PREFIX}${encodeURIComponent(userId)}:roles`
}

export function roleMenusCacheKey(roleCode: string) {
  return `${RBAC_ROLE_CACHE_PREFIX}${encodeURIComponent(roleCode)}:menu-list`
}
