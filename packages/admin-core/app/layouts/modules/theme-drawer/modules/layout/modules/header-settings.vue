<script setup lang="ts">
import SettingItem from '../../../components/setting-item.vue'

const { $ts } = useI18n()
const themeStore = useThemeStore()
</script>

<template>
  <SettingItem :title="$ts('theme.header.title')">
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.header.height') }}</span>
        <UInputNumber v-model="themeStore.header.height" :min="48" :max="72" class="w-32" />
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.header.breadcrumb.visible') }}</span>
        <USwitch v-model="themeStore.header.breadcrumbVisible" />
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.header.breadcrumb.showIcon') }}</span>
        <USwitch v-model="themeStore.header.breadcrumbIconVisible" />
      </div>
    </div>
  </SettingItem>
</template>
