<script setup lang="ts">
import type { LayoutMode, LayoutModeOption } from '#shared/layout'
import BaseThemeSettingsSection from './BaseThemeSettingsSection.vue'

const layoutMode = defineModel<LayoutMode>('layoutMode', { required: true })

const props = defineProps<{
  options: LayoutModeOption[]
}>()

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
  <div class="space-y-4">
    <BaseThemeSettingsSection :title="$t('theme.layoutMode.title') as string">
      <UAlert
        v-if="isSmallScreen"
        color="warning"
        variant="subtle"
        icon="i-lucide-info"
        :title="$t('theme.layoutMode.mobileDisabled') as string"
      />

      <div class="grid gap-2">
        <UButton
          v-for="option in props.options"
          :key="option.value"
          color="neutral"
          variant="outline"
          class="min-h-16 justify-start rounded-sm px-3 py-2 text-left ring-default"
          :class="layoutMode === option.value ? 'bg-elevated' : 'hover:bg-elevated/50'"
          :disabled="isSmallScreen"
          @click="layoutMode = option.value"
        >
          <template #leading>
            <UIcon :name="option.icon" class="size-5 shrink-0 text-primary" />
          </template>

          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-default">
              {{ option.label }}
            </p>
            <p class="line-clamp-2 text-xs text-muted">
              {{ option.description }}
            </p>
          </div>

          <template v-if="layoutMode === option.value" #trailing>
            <UIcon name="i-lucide-check" class="size-4 text-primary" />
          </template>
        </UButton>
      </div>
    </BaseThemeSettingsSection>
  </div>
</template>
