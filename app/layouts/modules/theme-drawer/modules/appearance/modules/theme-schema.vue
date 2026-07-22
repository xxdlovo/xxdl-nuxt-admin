<script setup lang="ts">
import ThemePickerButton from '../../../components/theme-picker-button.vue'
import SettingItem from '../../../components/setting-item.vue'

const { $ts } = useI18n()
const appConfig = useAppConfig()
const colorMode = useColorMode()

const blackAsPrimary = computed({
  get() {
    return appConfig.theme.blackAsPrimary
  },
  set(value) {
    appConfig.theme.blackAsPrimary = value
    window.localStorage.setItem('nuxt-ui-black-as-primary', String(value))
  }
})

const modes = computed(() => [
  { label: $ts('theme.themeSchema.light'), value: 'light', icon: appConfig.ui.icons.light },
  { label: $ts('theme.themeSchema.dark'), value: 'dark', icon: appConfig.ui.icons.dark },
  { label: $ts('theme.themeSchema.auto'), value: 'system', icon: appConfig.ui.icons.system }
])

const mode = computed({
  get() {
    return colorMode.preference
  },
  set(option) {
    colorMode.preference = option
    window.localStorage.setItem('nuxt-ui-color-mode', option)
  }
})
</script>

<template>
  <SettingItem :title="$ts('theme.themeSchema.title')">
    <div class="grid grid-cols-3 gap-2">
      <ThemePickerButton
        v-for="m in modes"
        :key="m.value"
        v-bind="m"
        :selected="mode === m.value"
        @click="mode = m.value"
      />
    </div>
  </SettingItem>
</template>
