<script setup lang="ts">
import SettingItem from '../../../components/setting-item.vue'

const { $ts } = useI18n()
const themeStore = useThemeStore()
</script>

<template>
  <SettingItem :title="$ts('theme.general')">
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.header.multilingual.visible') }}</span>
        <USwitch v-model="themeStore.general.localeVisible" />
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-default">{{ $ts('theme.header.globalSearch.visible') }}</span>
        <USwitch v-model="themeStore.general.globalSearchVisible" />
      </div>
    </div>
  </SettingItem>
</template>
