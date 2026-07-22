<script setup lang="ts">
import type { WatermarkTimeFormat } from '~/stores/theme'
import SettingItem from '../../../components/setting-item.vue'

const { $ts } = useI18n()
const themeStore = useThemeStore()

const timeFormatItems = computed(() => [
  { label: 'YYYY-MM-DD HH:mm', value: 'YYYY-MM-DD HH:mm' },
  { label: 'YYYY/MM/DD HH:mm', value: 'YYYY/MM/DD HH:mm' },
  { label: 'YYYY-MM-DD HH:mm:ss', value: 'YYYY-MM-DD HH:mm:ss' }
])

const currentTimeFormat = computed({
  get() {
    return themeStore.general.watermark.timeFormat
  },
  set(value: string) {
    themeStore.general.watermark.timeFormat = value as WatermarkTimeFormat
  }
})
</script>

<template>
  <SettingItem :title="$ts('theme.watermark.title')">
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.watermark.visible') }}</span>
        <USwitch v-model="themeStore.general.watermark.visible" />
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.watermark.enableUserName') }}</span>
        <USwitch v-model="themeStore.general.watermark.userNameVisible" />
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.watermark.currentTime') }}</span>
        <USwitch v-model="themeStore.general.watermark.currentTimeVisible" />
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.watermark.timeFormat') }}</span>
        <USelect
          v-model="currentTimeFormat"
          :items="timeFormatItems"
          class="w-52"
          :disabled="!themeStore.general.watermark.currentTimeVisible"
        />
      </div>
    </div>
  </SettingItem>
</template>
