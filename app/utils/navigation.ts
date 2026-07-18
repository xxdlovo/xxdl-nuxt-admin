import type { RbacMenu } from '#shared/auth'

export type NavigationMeta = {
  title?: string
  icon?: string | null
}

export function normalizeNavigationIcon(icon?: string | null) {
  return icon
}

export function findMenuByPath(menus: RbacMenu[], path: string): RbacMenu | null {
  for (const menu of menus) {
    if (menu.path === path) {
      return menu
    }

    const child = findMenuByPath(menu.children, path)
    if (child) {
      return child
    }
  }

  return null
}

export function findMenuTrail(menus: RbacMenu[], path: string): RbacMenu[] | null {
  for (const menu of menus) {
    if (menu.path === path) {
      return [menu]
    }

    const childTrail = findMenuTrail(menu.children, path)
    if (childTrail) {
      return [menu, ...childTrail]
    }
  }

  return null
}

export function resolveNavigationMeta(
  menus: RbacMenu[],
  path: string,
  meta: NavigationMeta = {},
  fallbackTitle = path
) {
  const menu = findMenuByPath(menus, path)

  return {
    title: meta.title || menu?.name || fallbackTitle,
    icon: normalizeNavigationIcon(menu?.icon)
  }
}
