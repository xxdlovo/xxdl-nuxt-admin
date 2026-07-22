<script setup lang="ts">
import SettingItem from '../../../components/setting-item.vue'

const { $ts } = useI18n()
const themeStore = useThemeStore()
</script>

<template>
  <SettingItem :title="$ts('theme.footer.title')">
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.footer.visible') }}</span>
        <USwitch v-model="themeStore.footer.visible" />
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.footer.height') }}</span>
        <UInputNumber v-model="themeStore.footer.height" :min="32" :max="80" class="w-32" />
      </div>
    </div>
  </SettingItem>
</template>
