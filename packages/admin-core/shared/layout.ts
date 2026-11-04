export const layoutModes = [
  'vertical',
  'vertical-mix',
  'vertical-hybrid-header-first',
  'horizontal',
  'top-hybrid-sidebar-first',
  'top-hybrid-header-first'
] as const

export type LayoutMode = (typeof layoutModes)[number]

export const layoutModeRecord: Record<LayoutMode, string> = {
  vertical: '左侧菜单模式',
  'vertical-mix': '左侧菜单混合模式',
  'vertical-hybrid-header-first': '左侧混合-顶部优先',
  horizontal: '顶部菜单模式',
  'top-hybrid-sidebar-first': '顶部混合-侧边优先',
  'top-hybrid-header-first': '顶部混合-顶部优先'
}

export const layoutModeDetailRecord: Record<LayoutMode, string> = {
  vertical: '左侧菜单布局，菜单在左，内容在右。',
  'vertical-mix': '左侧双菜单布局，一级菜单在左侧深色区域，二级菜单在左侧浅色区域。',
  'vertical-hybrid-header-first': '左侧混合布局，一级菜单在顶部，二级菜单在左侧深色区域，三级菜单在左侧浅色区域。',
  horizontal: '顶部菜单布局，菜单在顶部，内容在下方。',
  'top-hybrid-sidebar-first': '顶部混合布局，一级菜单在左侧，二级菜单在顶部。',
  'top-hybrid-header-first': '顶部混合布局，一级菜单在顶部，二级菜单在左侧。'
}

export const GLOBAL_HEADER_MENU_ID = '__GLOBAL_HEADER_MENU__'
export const GLOBAL_SIDER_MENU_ID = '__GLOBAL_SIDER_MENU__'

export type LayoutModeOption = {
  label: string
  value: LayoutMode
  icon: string
  description: string
}
