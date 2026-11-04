<script setup lang="ts">
import ThemePickerButton from '../../../components/theme-picker-button.vue'
import SettingItem from '../../../components/setting-item.vue'

const { $ts } = useI18n()
const appConfig = useAppConfig()

const radius = computed({
  get() {
    return appConfig.theme.radius
  },
  set(option) {
    appConfig.theme.radius = option
    window.localStorage.setItem('nuxt-ui-radius', String(appConfig.theme.radius))
  }
})

const radiuses = [0, 0.125, 0.25, 0.375, 0.5]
</script>

<template>
  <SettingItem :title="$ts('theme.radius')">
    <div class="grid grid-cols-5 gap-1 -mx-1">
      <ThemePickerButton
        v-for="r in radiuses"
        :key="r"
        :label="String(r)"
        class="justify-center px-0"
        :selected="radius === r"
        @click="radius = r"
      />
    </div>
  </SettingItem>
</template>
