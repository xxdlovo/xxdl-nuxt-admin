<script setup lang="ts">
import {
  neutralColorNames,
  resolveColorHex,
  themeColorKeys,
  themePaletteNames
} from '~/composables/themeColorUtils'
import ThemeColorSetting from '../../../components/theme-color-setting.vue'
import SettingItem from '../../../components/setting-item.vue'

const { $ts } = useI18n()
const appConfig = useAppConfig()
const colorMode = useColorMode()
const {
  getThemeColor,
  resetThemeColor,
  setThemeColor
} = useThemeColors()

type ThemeColorKey = (typeof themeColorKeys)[number]

const primaryRecommendations = themePaletteNames.map(resolveColorHex)
const neutralRecommendations = neutralColorNames.map(resolveColorHex)

function createColorRef(key: ThemeColorKey) {
  return computed({
    get() {
      return getThemeColor(key)
    },
    set(option) {
      setThemeColor(key, option)
    }
  })
}

const primary = createColorRef('primary')
const info = createColorRef('info')
const success = createColorRef('success')
const warning = createColorRef('warning')
const error = createColorRef('error')
const neutral = createColorRef('neutral')

const primaryPreviewHex = computed(() => {
  if (!appConfig.theme.blackAsPrimary) {
    return undefined
  }

  return colorMode.value === 'dark' ? '#FFFFFF' : '#000000'
})

</script>

<template>
  <SettingItem :title="$ts('theme.themeColor.title')">
    <div class="space-y-4">
      <ThemeColorSetting
        v-model="primary"
        :label="$ts('theme.themeColor.primary')"
        :recommendations="primaryRecommendations"
        :preview-hex="primaryPreviewHex"
        :default-label="$ts('common.default')"
        @reset="resetThemeColor('primary')"
      />

      <ThemeColorSetting
        v-model="info"
        :label="$ts('theme.themeColor.info')"
        :recommendations="primaryRecommendations"
        :default-label="$ts('common.default')"
        @reset="resetThemeColor('info')"
      />

      <ThemeColorSetting
        v-model="success"
        :label="$ts('theme.themeColor.success')"
        :recommendations="primaryRecommendations"
        :default-label="$ts('common.default')"
        @reset="resetThemeColor('success')"
      />

      <ThemeColorSetting
        v-model="warning"
        :label="$ts('theme.themeColor.warning')"
        :recommendations="primaryRecommendations"
        :default-label="$ts('common.default')"
        @reset="resetThemeColor('warning')"
      />

      <ThemeColorSetting
        v-model="error"
        :label="$ts('theme.themeColor.error')"
        :recommendations="primaryRecommendations"
        :default-label="$ts('common.default')"
        @reset="resetThemeColor('error')"
      />

      <ThemeColorSetting
        v-model="neutral"
        :label="$ts('theme.themeColor.neutral')"
        :recommendations="neutralRecommendations"
        :default-label="$ts('common.default')"
        @reset="resetThemeColor('neutral')"
      />
    </div>
  </SettingItem>
</template>
