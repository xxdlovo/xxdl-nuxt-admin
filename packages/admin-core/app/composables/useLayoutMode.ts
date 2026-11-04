import { storeToRefs } from 'pinia'
import type { LayoutMode, LayoutModeOption } from '#admin/shared/layout'

export function useLayoutMode() {
  const { $ts } = useI18n()
  const themeStore = useThemeStore()
  const { layoutMode } = storeToRefs(themeStore)

  const layoutModeOptions = computed<LayoutModeOption[]>(() => [
    {
      label: $ts('theme.layoutMode.vertical') as string,
      value: 'vertical',
      icon: 'i-lucide-panel-left',
      description: $ts('theme.layoutMode.verticalDesc') as string
    },
    {
      label: $ts('theme.layoutMode.vertical-mix') as string,
      value: 'vertical-mix',
      icon: 'i-lucide-panels-left-bottom',
      description: $ts('theme.layoutMode.verticalMixDesc') as string
    },
    {
      label: $ts('theme.layoutMode.vertical-hybrid-header-first') as string,
      value: 'vertical-hybrid-header-first',
      icon: 'i-lucide-panel-top',
      description: $ts('theme.layoutMode.verticalHybridHeaderFirstDesc') as string
    },
    {
      label: $ts('theme.layoutMode.horizontal') as string,
      value: 'horizontal',
      icon: 'i-lucide-panel-top-open',
      description: $ts('theme.layoutMode.horizontalDesc') as string
    },
    {
      label: $ts('theme.layoutMode.top-hybrid-sidebar-first') as string,
      value: 'top-hybrid-sidebar-first',
      icon: 'i-lucide-panel-left-dashed',
      description: $ts('theme.layoutMode.topHybridSidebarFirstDesc') as string
    },
    {
      label: $ts('theme.layoutMode.top-hybrid-header-first') as string,
      value: 'top-hybrid-header-first',
      icon: 'i-lucide-panel-top-dashed',
      description: $ts('theme.layoutMode.topHybridHeaderFirstDesc') as string
    }
  ])

  function setLayoutMode(value: LayoutMode) {
    themeStore.setLayoutMode(value)
  }

  return {
    layoutMode,
    layoutModeOptions,
    setLayoutMode
  }
}
