<script setup lang="ts">
import { storeToRefs } from 'pinia'
import type { Component } from 'vue'
import type { LayoutMode } from '#shared/layout'
import LayoutHorizontal from '~/components/layout/modes/LayoutHorizontal.vue'
import LayoutTopHybridHeaderFirst from '~/components/layout/modes/LayoutTopHybridHeaderFirst.vue'
import LayoutTopHybridSidebarFirst from '~/components/layout/modes/LayoutTopHybridSidebarFirst.vue'
import LayoutVertical from '~/components/layout/modes/LayoutVertical.vue'
import LayoutVerticalHybridHeaderFirst from '~/components/layout/modes/LayoutVerticalHybridHeaderFirst.vue'
import LayoutVerticalMix from '~/components/layout/modes/LayoutVerticalMix.vue'

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

  toast.add({
    title: 'We use first-party cookies to enhance your experience on our website.',
    duration: 0,
    close: false,
    actions: [{
      label: 'Accept',
      color: 'neutral',
      variant: 'outline',
      onClick: () => {
        cookie.value = 'accepted'
      }
    }, {
      label: 'Opt out',
      color: 'neutral',
      variant: 'ghost'
    }]
  })
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
