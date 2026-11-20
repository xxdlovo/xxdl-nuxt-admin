import type { EntitlementProfile } from '#admin/shared/entitlement/types'

/**
 * Minimal user fields needed by RBAC consumers.
 */
export type RbacUser = {
  id: string
  username: string
  email?: string | null
  nickname?: string | null
  avatar?: string | null
  phone?: string | null
  gender?: number | null
  deptId?: string | null
  isAdmin?: number | null
}

/**
 * Role summary used by auth profile, menus and future permission checks.
 */
export type RbacRole = {
  id: string
  name: string
  code: string
  dataScope?: string | null
}

/**
 * Tree menu item returned to the frontend for sidebar rendering.
 */
export type RbacMenu = {
  id: string
  parentId: string | null
  name: string
  code: string
  type: number
  path: string | null
  component: string | null
  externalLink?: string | null
  routeQuery?: string | null
  icon: string | null
  sortOrder: number
  visible: number
  children: RbacMenu[]
}

/**
 * Flat permission/menu record from server queries before tree construction.
 */
export type RbacFlatMenu = Omit<RbacMenu, 'children'>

/**
 * Cross-module RBAC read model for the current signed-in user.
 */
export type RbacProfile = {
  user: RbacUser
  roles: RbacRole[]
  permissions: string[]
  menus: RbacMenu[]
  /**
   * 能力档案（功能开关 + 配额）。
   *
   * 可选是为了向后兼容：不接入能力体系的项目 / 旧版服务端响应可以不带该字段，
   * 其余 RBAC 消费方无需改动。前端从 `profile.entitlements` 读，缺省按「无能力」处理。
   */
  entitlements?: EntitlementProfile
}
