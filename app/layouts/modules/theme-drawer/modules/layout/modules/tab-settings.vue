<script setup lang="ts">
import type { TabMode } from '~/stores/theme'
import SettingItem from '../../../components/setting-item.vue'

const { $ts } = useI18n()
const themeStore = useThemeStore()

const tabModeItems = computed(() => [
  { label: $ts('theme.tab.mode.chrome'), value: 'chrome' },
  { label: $ts('theme.tab.mode.button'), value: 'button' }
])

const currentTabMode = computed({
  get() {
    return themeStore.tab.mode
  },
  set(value: TabMode) {
    themeStore.tab.mode = value
  }
})
</script>

<template>
  <SettingItem :title="$ts('theme.tab.title')">
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.tab.visible') }}</span>
        <USwitch v-model="themeStore.tab.visible" />
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.tab.height') }}</span>
        <UInputNumber v-model="themeStore.tab.height" :min="32" :max="64" class="w-32" />
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.tab.mode.title') }}</span>
        <USelect v-model="currentTabMode" :items="tabModeItems" class="w-36" />
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.tab.middleClickClose') }}</span>
        <USwitch v-model="themeStore.tab.middleClickClose" />
      </div>
    </div>
  </SettingItem>
</template>
