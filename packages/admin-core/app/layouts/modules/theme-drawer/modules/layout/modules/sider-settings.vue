<script setup lang="ts">
import SettingItem from '../../../components/setting-item.vue'

const { $ts } = useI18n()
const themeStore = useThemeStore()
</script>

<template>
  <SettingItem :title="$ts('theme.sider.title')">
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.sider.width') }}</span>
        <UInputNumber v-model="themeStore.sider.width" :min="160" :max="320" class="w-32" />
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.sider.collapsedWidth') }}</span>
        <UInputNumber v-model="themeStore.sider.collapsedWidth" :min="48" :max="96" class="w-32" />
      </div>
    </div>
  </SettingItem>
</template>
