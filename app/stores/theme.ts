import { defineStore } from 'pinia'
import { layoutModes, type LayoutMode } from '#shared/layout'

const layoutModeStorageKey = 'theme:layoutMode'

function normalizeLayoutMode(value?: string | null): LayoutMode {
  return layoutModes.includes(value as LayoutMode) ? value as LayoutMode : 'vertical'
}

export const useThemeStore = defineStore('theme', () => {
  const layoutMode = ref<LayoutMode>('vertical')
  const siderCollapse = ref(false)
  const mixSiderFixed = ref(false)

  const header = reactive({
    height: 56
  })

  const sider = reactive({
    width: 220,
    collapsedWidth: 64,
    mixWidth: 90,
    mixCollapsedWidth: 64,
    mixChildMenuWidth: 200,
    autoSelectFirstMenu: false
  })

  function setLayoutMode(mode: LayoutMode) {
    layoutMode.value = mode
    mixSiderFixed.value = false
  }

  function toggleSiderCollapse() {
    siderCollapse.value = !siderCollapse.value
  }

  function setSiderCollapse(value: boolean) {
    siderCollapse.value = value
  }

  function toggleMixSiderFixed() {
    mixSiderFixed.value = !mixSiderFixed.value
  }

  if (import.meta.client) {
    layoutMode.value = normalizeLayoutMode(window.localStorage.getItem(layoutModeStorageKey))

    watch(layoutMode, value => {
      window.localStorage.setItem(layoutModeStorageKey, value)
    })
  }

  return {
    layoutMode,
    siderCollapse,
    mixSiderFixed,
    header,
    sider,
    setLayoutMode,
    toggleSiderCollapse,
    setSiderCollapse,
    toggleMixSiderFixed
  }
})
