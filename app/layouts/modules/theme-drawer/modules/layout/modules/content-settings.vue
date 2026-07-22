<script setup lang="ts">
import type { PageAnimateMode, ScrollMode } from '~/stores/theme'
import SettingItem from '../../../components/setting-item.vue'

const { $ts } = useI18n()
const themeStore = useThemeStore()

const scrollModeItems = computed(() => [
  { label: $ts('theme.scrollMode.wrapper'), value: 'wrapper' },
  { label: $ts('theme.scrollMode.content'), value: 'content' }
])

const pageAnimateModeItems = computed(() => [
  { label: $ts('theme.page.mode.fade-slide'), value: 'fade-slide' },
  { label: $ts('theme.page.mode.fade'), value: 'fade' },
  { label: $ts('theme.page.mode.fade-bottom'), value: 'fade-bottom' },
  { label: $ts('theme.page.mode.fade-scale'), value: 'fade-scale' },
  { label: $ts('theme.page.mode.zoom-fade'), value: 'zoom-fade' },
  { label: $ts('theme.page.mode.zoom-out'), value: 'zoom-out' },
  { label: $ts('theme.page.mode.none'), value: 'none' }
])

const currentScrollMode = computed({
  get() {
    return themeStore.content.scrollMode
  },
  set(value: ScrollMode) {
    themeStore.content.scrollMode = value
  }
})

const currentPageAnimateMode = computed({
  get() {
    return themeStore.content.pageAnimateMode
  },
  set(value: PageAnimateMode) {
    themeStore.content.pageAnimateMode = value
  }
})
</script>

<template>
  <SettingItem :title="$ts('theme.content.title')">
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.scrollMode.title') }}</span>
        <USelect v-model="currentScrollMode" :items="scrollModeItems" class="w-36" />
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.page.animate') }}</span>
        <USwitch v-model="themeStore.content.pageAnimate" />
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.page.mode.title') }}</span>
        <USelect v-model="currentPageAnimateMode" :items="pageAnimateModeItems" class="w-36" />
      </div>
    </div>
  </SettingItem>
</template>
