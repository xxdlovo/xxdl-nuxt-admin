<script setup lang="ts">
import type { LayoutMode, LayoutModeOption } from '#shared/layout'
import BaseThemeSettingsSection from '../../BaseThemeSettingsSection.vue'
import LayoutModeCard from './layout-mode-card.vue'

const layoutMode = defineModel<LayoutMode>('layoutMode', { required: true })

defineProps<{
  options: LayoutModeOption[]
}>()

const { $ts } = useI18n()
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
  <BaseThemeSettingsSection :title="$ts('theme.layoutMode.title')">
    <UAlert
      v-if="isSmallScreen"
      color="warning"
      variant="subtle"
      icon="i-lucide-info"
      :title="$ts('theme.layoutMode.mobileDisabled')"
    />

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <LayoutModeCard
        v-for="option in options"
        :key="option.value"
        :option="option"
        :selected="layoutMode === option.value"
        :disabled="isSmallScreen"
        @click="layoutMode = option.value"
      />
    </div>
  </BaseThemeSettingsSection>
</template>
