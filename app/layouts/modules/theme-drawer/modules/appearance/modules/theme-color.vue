<script setup lang="ts">
import {
  applyThemeColorStyles,
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

type ThemeColorKey = (typeof themeColorKeys)[number]

const primaryRecommendations = themePaletteNames.map(resolveColorHex)
const neutralRecommendations = neutralColorNames.map(resolveColorHex)

function getThemeColor(key: ThemeColorKey) {
  const saved = appConfig.theme.colors?.[key]
  if (saved) {
    return saved
  }

  return resolveColorHex(appConfig.ui.colors[key])
}

function setThemeColor(key: ThemeColorKey, value: string) {
  if (!appConfig.theme.colors) {
    appConfig.theme.colors = {}
  }

  appConfig.theme.colors[key] = value
  applyThemeColorStyles({
    primary: getThemeColor('primary'),
    info: getThemeColor('info'),
    success: getThemeColor('success'),
    warning: getThemeColor('warning'),
    error: getThemeColor('error'),
    neutral: getThemeColor('neutral')
  })
  window.localStorage.setItem(`nuxt-ui-theme-${key}`, value)
}

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

function loadSavedThemeColors() {
  if (typeof window === 'undefined') {
    return
  }

  for (const key of themeColorKeys) {
    const savedValue = window.localStorage.getItem(`nuxt-ui-theme-${key}`) || window.localStorage.getItem(`nuxt-ui-${key}`)
    if (savedValue) {
      setThemeColor(key, resolveColorHex(savedValue))
    }
  }
}

onBeforeMount(() => {
  loadSavedThemeColors()
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
      />

      <ThemeColorSetting
        v-model="info"
        :label="$ts('theme.themeColor.info')"
        :recommendations="primaryRecommendations"
      />

      <ThemeColorSetting
        v-model="success"
        :label="$ts('theme.themeColor.success')"
        :recommendations="primaryRecommendations"
      />

      <ThemeColorSetting
        v-model="warning"
        :label="$ts('theme.themeColor.warning')"
        :recommendations="primaryRecommendations"
      />

      <ThemeColorSetting
        v-model="error"
        :label="$ts('theme.themeColor.error')"
        :recommendations="primaryRecommendations"
      />

      <ThemeColorSetting
        v-model="neutral"
        :label="$ts('theme.themeColor.neutral')"
        :recommendations="neutralRecommendations"
      />
    </div>
  </SettingItem>
</template>
