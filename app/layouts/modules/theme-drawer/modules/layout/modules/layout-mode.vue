<script setup lang="ts">
import LayoutModeCard from '../../../components/layout-mode-card.vue'
import SettingItem from '../../../components/setting-item.vue'

const { $ts } = useI18n()
const { layoutMode } = useLayoutMode()

const isSmallScreen = ref(false)
let smallScreenMedia: MediaQueryList | null = null

function syncSmallScreen(value: boolean) {
  isSmallScreen.value = value
}

function handleSmallScreenChange(event: MediaQueryListEvent) {
  syncSmallScreen(event.matches)
}

onMounted(() => {
  smallScreenMedia = window.matchMedia('(max-width: 1023px)')
  syncSmallScreen(smallScreenMedia.matches)
  smallScreenMedia.addEventListener('change', handleSmallScreenChange)
})

onBeforeUnmount(() => {
  smallScreenMedia?.removeEventListener('change', handleSmallScreenChange)
})
</script>

<template>
  <SettingItem :title="$ts('theme.layoutMode.title')">
    <UAlert
      v-if="isSmallScreen"
      color="warning"
      variant="subtle"
      icon="i-lucide-info"
      :title="$ts('theme.layoutMode.mobileDisabled')"
    />
    <LayoutModeCard v-model:mode="layoutMode" :disabled="isSmallScreen">
      <template #vertical>
        <div class="grid h-full grid-cols-[18px_minmax(0,1fr)] gap-1">
          <div class="layout-sider h-full bg-primary" />
          <div class="grid min-h-0 grid-rows-[10px_1fr] gap-1">
            <div class="layout-header bg-primary/35" />
            <div class="layout-main bg-primary/20" />
          </div>
        </div>
      </template>

      <template #vertical-mix>
        <div class="grid h-full grid-cols-[8px_16px_minmax(0,1fr)] gap-1">
          <div class="layout-sider h-full bg-primary" />
          <div class="layout-sider h-full bg-primary/45" />
          <div class="grid min-h-0 grid-rows-[10px_1fr] gap-1">
            <div class="layout-header bg-primary/35" />
            <div class="layout-main bg-primary/20" />
          </div>
        </div>
      </template>

      <template #vertical-hybrid-header-first>
        <div class="grid h-full grid-cols-[8px_16px_minmax(0,1fr)] gap-1">
          <div class="layout-sider h-full bg-primary" />
          <div class="layout-sider h-full bg-primary/45" />
          <div class="grid min-h-0 grid-rows-[10px_1fr] gap-1">
            <div class="layout-header bg-primary" />
            <div class="layout-main bg-primary/20" />
          </div>
        </div>
      </template>

      <template #horizontal>
        <div class="flex h-full flex-col gap-1">
          <div class="layout-header h-[10px] bg-primary" />
          <div class="layout-main flex-1 bg-primary/20" />
        </div>
      </template>

      <template #top-hybrid-sidebar-first>
        <div class="flex h-full flex-col gap-1">
          <div class="layout-header h-[10px] bg-primary/35" />
          <div class="grid min-h-0 flex-1 grid-cols-[18px_minmax(0,1fr)] gap-1">
            <div class="layout-sider h-full bg-primary" />
            <div class="layout-main bg-primary/20" />
          </div>
        </div>
      </template>

      <template #top-hybrid-header-first>
        <div class="flex h-full flex-col gap-1">
          <div class="layout-header h-[10px] bg-primary" />
          <div class="grid min-h-0 flex-1 grid-cols-[18px_minmax(0,1fr)] gap-1">
            <div class="layout-sider h-full bg-primary/35" />
            <div class="layout-main bg-primary/20" />
          </div>
        </div>
      </template>
    </LayoutModeCard>
  </SettingItem>
</template>
