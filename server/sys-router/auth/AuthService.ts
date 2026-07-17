import type { Context, AuthUser } from '#server/trpc/context'
import { sysMenuService } from '#server/sys-router/menu/SysMenuService'
import { sysRoleService } from '#server/sys-router/role/SysRoleService'
import type { RbacFlatMenu, RbacMenu, RbacProfile } from '#shared/auth'

function sortMenus(menus: RbacMenu[]) {
  menus.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  menus.forEach(menu => sortMenus(menu.children))
}

function buildMenuTree(flatMenus: RbacFlatMenu[]) {
  const nodes = new Map<string, RbacMenu>()
  const roots: RbacMenu[] = []

  for (const menu of flatMenus) {
    nodes.set(menu.id, { ...menu, children: [] })
  }

  for (const menu of nodes.values()) {
    const parent = menu.parentId ? nodes.get(menu.parentId) : null
    if (parent) {
      parent.children.push(menu)
    } else {
      roots.push(menu)
    }
  }

  sortMenus(roots)
  return roots
}

function uniqById<T extends { id: string }>(items: T[]) {
  const map = new Map<string, T>()
  items.forEach(item => map.set(item.id, item))
  return Array.from(map.values())
}

export function authService(ctx: Context) {
  return {
    /**
     * Build the current user's RBAC read model for frontend menus and permission checks.
     * Entity-specific queries stay in role/menu services; auth only assembles the profile.
     */
    async getRbacProfile(user: AuthUser): Promise<RbacProfile> {
      const roleItems = uniqById(await sysRoleService(ctx).listEnabledByUserId(user.id))
      const menus = user.isAdmin === 1
        ? await sysMenuService(ctx).listEnabledForAdmin()
        : await sysMenuService(ctx).listEnabledByRoleIds(roleItems.map(role => role.id))

      const flatMenus = uniqById(menus)
      const menuTreeItems = flatMenus.filter(menu => menu.visible === 1 && menu.type !== 2)

      return {
        user,
        roles: roleItems,
        permissions: flatMenus.map(menu => menu.code),
        menus: buildMenuTree(menuTreeItems)
      }
    },

    /**
     * List permission codes for backend endpoint guards.
     * The result is flat and request-cached by the permission middleware.
     */
    async listPermissionCodes(user: AuthUser): Promise<string[]> {
      const roleItems = uniqById(await sysRoleService(ctx).listEnabledByUserId(user.id))
      const menus = user.isAdmin === 1
        ? await sysMenuService(ctx).listEnabledForAdmin()
        : await sysMenuService(ctx).listEnabledByRoleIds(roleItems.map(role => role.id))

      return Array.from(new Set(menus.map(menu => menu.code)))
    }
  }
}
