import { storeToRefs } from 'pinia'
import type { LayoutMode, LayoutModeOption } from '#shared/layout'

export function useLayoutMode() {
  const { $t } = useI18n()
  const themeStore = useThemeStore()
  const { layoutMode } = storeToRefs(themeStore)

  const layoutModeOptions = computed<LayoutModeOption[]>(() => [
    {
      label: $t('theme.layoutMode.vertical') as string,
      value: 'vertical',
      icon: 'i-lucide-panel-left',
      description: $t('theme.layoutMode.verticalDesc') as string
    },
    {
      label: $t('theme.layoutMode.vertical-mix') as string,
      value: 'vertical-mix',
      icon: 'i-lucide-panels-left-bottom',
      description: $t('theme.layoutMode.verticalMixDesc') as string
    },
    {
      label: $t('theme.layoutMode.vertical-hybrid-header-first') as string,
      value: 'vertical-hybrid-header-first',
      icon: 'i-lucide-panel-top',
      description: $t('theme.layoutMode.verticalHybridHeaderFirstDesc') as string
    },
    {
      label: $t('theme.layoutMode.horizontal') as string,
      value: 'horizontal',
      icon: 'i-lucide-panel-top-open',
      description: $t('theme.layoutMode.horizontalDesc') as string
    },
    {
      label: $t('theme.layoutMode.top-hybrid-sidebar-first') as string,
      value: 'top-hybrid-sidebar-first',
      icon: 'i-lucide-panel-left-dashed',
      description: $t('theme.layoutMode.topHybridSidebarFirstDesc') as string
    },
    {
      label: $t('theme.layoutMode.top-hybrid-header-first') as string,
      value: 'top-hybrid-header-first',
      icon: 'i-lucide-panel-top-dashed',
      description: $t('theme.layoutMode.topHybridHeaderFirstDesc') as string
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
