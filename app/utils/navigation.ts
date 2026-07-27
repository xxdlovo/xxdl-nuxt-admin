import type { RbacMenu } from '#shared/auth'
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'

export type NavigationMeta = {
  title?: string
  icon?: string | null
}

export function normalizeNavigationIcon(icon?: string | null) {
  const normalizedIcon = icon?.trim()

  if (!normalizedIcon) {
    return undefined
  }

  if (normalizedIcon.startsWith('i-') && !normalizedIcon.includes(':')) {
    return normalizedIcon
  }

  const iconifyMatch = normalizedIcon.match(/^(?:i-)?([\w-]+):([\w-]+)$/)
  if (iconifyMatch) {
    return `i-${iconifyMatch[1]}-${iconifyMatch[2]}`
  }

  return normalizedIcon
}

export function normalizeMenuIcon(icon?: string | null) {
  return normalizeNavigationIcon(icon) || 'i-lucide-circle'
}

export function isRenderableMenu(menu: RbacMenu) {
  return menu.type !== 2
}

export function isClickableMenu(menu: RbacMenu) {
  return menu.type !== 0 && Boolean(menu.path)
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

export function getRenderableMenus(menus: RbacMenu[]) {
  return menus.filter(isRenderableMenu)
}

export function findFirstPath(menu?: RbacMenu | null): string | undefined {
  if (!menu) {
    return undefined
  }

  if (isClickableMenu(menu)) {
    return menu.path || undefined
  }

  for (const child of getRenderableMenus(menu.children)) {
    const path = findFirstPath(child)
    if (path) {
      return path
    }
  }

  return undefined
}

export function resolveActiveTrail(menus: RbacMenu[], path: string) {
  const trail = findMenuTrail(menus, path)
  if (trail) {
    return trail
  }

  const first = getRenderableMenus(menus)[0]
  return first ? [first] : []
}

export function toNavigationItem(menu: RbacMenu, onSelect?: (menu: RbacMenu) => void): NavigationMenuItem {
  const children = getRenderableMenus(menu.children).map(child => toNavigationItem(child, onSelect))
  const clickable = isClickableMenu(menu)
  const item: NavigationMenuItem = {
    label: menu.name,
    icon: normalizeMenuIcon(menu.icon),
    to: clickable ? menu.path || undefined : undefined,
    exact: clickable,
    children: children.length > 0 ? children : undefined
  }

  if (onSelect) {
    item.onSelect = () => onSelect(menu)
  }

  return item
}

export function toNavigationItems(menus: RbacMenu[], onSelect?: (menu: RbacMenu) => void) {
  return getRenderableMenus(menus).map(menu => toNavigationItem(menu, onSelect))
}

export function toDropdownMenuItem(menu: RbacMenu, onSelect?: (menu: RbacMenu) => void): DropdownMenuItem {
  const children = getRenderableMenus(menu.children).map(child => toDropdownMenuItem(child, onSelect))
  const clickable = isClickableMenu(menu)
  const item: DropdownMenuItem = {
    label: menu.name,
    icon: normalizeMenuIcon(menu.icon),
    to: clickable ? menu.path || undefined : undefined,
    exact: clickable,
    children: children.length > 0 ? children : undefined
  }

  if (onSelect && clickable) {
    item.onSelect = () => onSelect(menu)
  }

  return item
}

export function toDropdownMenuItems(menus: RbacMenu[], onSelect?: (menu: RbacMenu) => void) {
  return getRenderableMenus(menus).map(menu => toDropdownMenuItem(menu, onSelect))
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
