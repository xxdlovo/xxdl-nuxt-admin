<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Component } from 'vue'
import type { LayoutMode } from '#shared/layout'
import LayoutHorizontal from './modules/global-menu/modules/horizontal-menu.vue'
import LayoutTopHybridHeaderFirst from './modules/global-menu/modules/top-hybrid-header-first.vue'
import LayoutTopHybridSidebarFirst from './modules/global-menu/modules/top-hybrid-sidebar-first.vue'
import LayoutVertical from './modules/global-menu/modules/vertical-menu.vue'
import LayoutVerticalHybridHeaderFirst from './modules/global-menu/modules/vertical-hybrid-header-first.vue'
import LayoutVerticalMix from './modules/global-menu/modules/vertical-mix-menu.vue'

const toast = useToast()
const { profile, loading: menuLoading, loadProfile } = useRbacProfile()
const tabsStore = useTabsStore()
const { refreshKey } = storeToRefs(tabsStore)
const themeStore = useThemeStore()
const { layoutMode, siderCollapse } = storeToRefs(themeStore)

const open = ref(false)
const isSmallScreen = ref(false)
const menus = computed(() => profile.value?.menus ?? [])

const modeMap: Record<LayoutMode, Component> = {
  vertical: LayoutVertical,
  'vertical-mix': LayoutVerticalMix,
  'vertical-hybrid-header-first': LayoutVerticalHybridHeaderFirst,
  horizontal: LayoutHorizontal,
  'top-hybrid-sidebar-first': LayoutTopHybridSidebarFirst,
  'top-hybrid-header-first': LayoutTopHybridHeaderFirst
}

const activeLayout = computed(() => {
  return isSmallScreen.value ? LayoutVertical : modeMap[layoutMode.value]
})

let smallScreenMedia: MediaQueryList | null = null

function syncSmallScreen(value: boolean) {
  isSmallScreen.value = value

  if (!value) {
    open.value = false
  }
}

function handleSmallScreenChange(event: MediaQueryListEvent) {
  syncSmallScreen(event.matches)
}

onMounted(async () => {
  smallScreenMedia = window.matchMedia('(max-width: 1023px)')
  syncSmallScreen(smallScreenMedia.matches)
  smallScreenMedia.addEventListener('change', handleSmallScreenChange)

  try {
    await loadProfile()
  } catch {
    return
  }

  const cookie = useCookie('cookie-consent')
  if (cookie.value === 'accepted') {
    return
  }
})

onBeforeUnmount(() => {
  smallScreenMedia?.removeEventListener('change', handleSmallScreenChange)
})
</script>

<template>
  <component
    :is="activeLayout"
    v-model:open="open"
    v-model:collapsed="siderCollapse"
    :menus="menus"
    :loading="menuLoading"
    :refresh-key="refreshKey"
    :mobile="isSmallScreen"
  >
    <slot />
  </component>
</template>
