<script setup lang="ts">
import {
  applyThemeColorStyles,
  neutralColorNames,
  resolveColorHex,
  themeColorKeys,
  themePaletteNames
} from '~/composables/themeColorUtils'
import BaseThemeAppearanceTab from './BaseThemeAppearanceTab.vue'
import BaseThemeTabPlaceholder from './BaseThemeTabPlaceholder.vue'

const { $t } = useI18n()
const appConfig = useAppConfig()
const colorMode = useColorMode()

type ThemeColorKey = (typeof themeColorKeys)[number]

const activeTab = ref<'appearance' | 'layout' | 'general'>('appearance')

const primaryRecommendations = themePaletteNames.map(resolveColorHex)
const neutralRecommendations = neutralColorNames.map(resolveColorHex)

const blackAsPrimary = computed({
  get() {
    return appConfig.theme.blackAsPrimary
  },
  set(value) {
    setBlackAsPrimary(value)
  }
})

const radius = computed({
  get() {
    return appConfig.theme.radius
  },
  set(option) {
    appConfig.theme.radius = option
    window.localStorage.setItem('nuxt-ui-radius', String(appConfig.theme.radius))
  }
})

const mode = computed({
  get() {
    return colorMode.preference
  },
  set(option) {
    colorMode.preference = option
    window.localStorage.setItem('nuxt-ui-color-mode', option)
  }
})

const tabs = computed(() => [
  { label: $t('theme.appearance') as string, value: 'appearance', slot: 'appearance', icon: 'i-lucide-palette' },
  { label: $t('theme.layout') as string, value: 'layout', slot: 'layout', icon: 'i-lucide-layout-dashboard' },
  { label: $t('theme.general') as string, value: 'general', slot: 'general', icon: 'i-lucide-settings-2' }
])

const open = ref(false)

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
      if (key === 'primary') {
        setBlackAsPrimary(false)
      }
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

function setBlackAsPrimary(value: boolean) {
  appConfig.theme.blackAsPrimary = value
  window.localStorage.setItem('nuxt-ui-black-as-primary', String(value))
}

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

  const savedRadius = window.localStorage.getItem('nuxt-ui-radius')
  const savedColorMode = window.localStorage.getItem('nuxt-ui-color-mode')
  const savedBlackAsPrimary = window.localStorage.getItem('nuxt-ui-black-as-primary')

  if (savedRadius) {
    radius.value = Number(savedRadius)
  }

  if (savedColorMode) {
    colorMode.preference = savedColorMode as any
  }

  if (savedBlackAsPrimary) {
    setBlackAsPrimary(savedBlackAsPrimary === 'true')
  }
}

onBeforeMount(() => {
  loadSavedThemeColors()
})
</script>

<template>
  <USlideover
    v-model:open="open"
    side="right"
    :ui="{ content: 'w-[36rem] max-w-[calc(100vw-1rem)]' }"
  >
    <template #default>
      <UButton
        icon="i-lucide-swatch-book"
        color="neutral"
        :variant="open ? 'soft' : 'ghost'"
        square
        aria-label="Theme settings"
        :ui="{ leadingIcon: 'text-primary' }"
      />
    </template>

    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-default">
            {{ $t('theme.appearance') }}
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <UScrollArea class="flex-1">
        <div class="space-y-4 p-4">
          <!-- tab 只负责切换主题分类，具体内容下沉到各自的子组件里。 -->
          <UTabs v-model="activeTab" :items="tabs" color="primary" class="w-full" />

          <BaseThemeAppearanceTab
            v-if="activeTab === 'appearance'"
            v-model:primary="primary"
            v-model:info="info"
            v-model:success="success"
            v-model:warning="warning"
            v-model:error="error"
            v-model:neutral="neutral"
            v-model:mode="mode"
            v-model:radius="radius"
            v-model:black-as-primary="blackAsPrimary"
            :primary-recommendations="primaryRecommendations"
            :neutral-recommendations="neutralRecommendations"
            :primary-preview-hex="primaryPreviewHex"
          />

          <BaseThemeTabPlaceholder
            v-else-if="activeTab === 'layout'"
            icon="i-lucide-layout-dashboard"
            :title="$t('theme.layout') as string"
            :description="$t('common.lookForward') as string"
          />

          <BaseThemeTabPlaceholder
            v-else
            icon="i-lucide-settings-2"
            :title="$t('theme.general') as string"
            :description="$t('common.lookForward') as string"
          />
        </div>
      </UScrollArea>
    </template>
  </USlideover>
</template>
