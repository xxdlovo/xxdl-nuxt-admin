<script setup lang="ts">
const themeStore = useThemeStore()

defineProps<{
  refreshKey: number
}>()

const panelUi = computed(() => ({
  body: themeStore.content.scrollMode === 'wrapper'
    ? 'p-0 sm:p-0 gap-0 sm:gap-0 overflow-y-auto'
    : 'p-0 sm:p-0 gap-0 sm:gap-0 overflow-hidden'
}))

const contentClass = computed(() => themeStore.content.scrollMode === 'wrapper'
  ? 'flex-1 min-h-0 overflow-visible'
  : 'flex-1 min-h-0 overflow-auto')
</script>

<template>
  <UDashboardPanel id="home" :ui="panelUi">
    <template #header>
      <slot name="header" />
      <AppTabsBar v-if="themeStore.tab.visible" />
    </template>

    <template #body>
      <div :key="refreshKey" :class="contentClass">
        <slot />
      </div>
    </template>

    <template v-if="themeStore.footer.visible" #footer>
      <div
        class="flex shrink-0 items-center justify-center border-t border-default bg-default text-xs text-muted"
        :style="{ height: `${themeStore.footer.height}px` }"
      >
        PowerBy nuxt
      </div>
    </template>
  </UDashboardPanel>
</template>
