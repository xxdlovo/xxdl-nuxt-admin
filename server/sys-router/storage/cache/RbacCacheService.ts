import type { RbacFlatMenu, RbacRole } from '#shared/auth'
import { SysStorageService } from '../SysStorageService'
import {
  RBAC_ADMIN_CACHE_KEY,
  RBAC_ROLE_CACHE_PREFIX,
  RBAC_USER_CACHE_PREFIX,
  RBAC_CACHE_TTL_SECONDS,
  roleMenusCacheKey,
  userRolesCacheKey
} from './StorageCacheKeys'

/**
 * RBAC 缓存门面：用户角色按 userId，角色菜单按 roleCode，管理员菜单单独缓存。
 * 不缓存完整 profile，避免用户菜单树与角色关系产生重复且难以失效的副本。
 */
export class RbacCacheService {
  private readonly storage = new SysStorageService()

  async getUserRoles(userId: string, loader: () => Promise<RbacRole[]>) {
    return this.storage.rememberCache(userRolesCacheKey(userId), loader, { ttlSeconds: RBAC_CACHE_TTL_SECONDS })
  }

  async getRoleMenus(roleCode: string, loader: () => Promise<RbacFlatMenu[]>) {
    return this.storage.rememberCache(roleMenusCacheKey(roleCode), loader, { ttlSeconds: RBAC_CACHE_TTL_SECONDS })
  }

  async getAdminMenus(loader: () => Promise<RbacFlatMenu[]>) {
    return this.storage.rememberCache(RBAC_ADMIN_CACHE_KEY, loader, { ttlSeconds: RBAC_CACHE_TTL_SECONDS })
  }

  async invalidateUser(userId: string) {
    await this.storage.removeCache(userRolesCacheKey(userId))
  }

  async invalidateRole(roleCode: string) {
    await this.storage.removeCache(roleMenusCacheKey(roleCode))
  }

  async invalidateAllRoles() {
    await this.storage.clearCache(RBAC_ROLE_CACHE_PREFIX)
  }

  async invalidateAdmin() {
    await this.storage.removeCache(RBAC_ADMIN_CACHE_KEY)
  }

  async invalidateAllUsers() {
    await this.storage.clearCache(RBAC_USER_CACHE_PREFIX)
  }
}

export const rbacCacheService = () => new RbacCacheService()
