<script setup lang="ts">
import ThemeAppearance from './modules/appearance/index.vue'
import ThemeGeneral from './modules/general/index.vue'
import ThemeLayout from './modules/layout/index.vue'
import ThemePreset from './modules/preset/index.vue'

defineOptions({
  name: 'ThemeDrawer'
})

const {$ts} = useI18n()
const appConfig = useAppConfig()
const colorMode = useColorMode()
const toast = useToast()
const themeStore = useThemeStore()
const { resetBlackAsPrimary, resetThemeColors } = useThemeColors()
const activeTab = ref<'appearance' | 'layout' | 'general' | 'preset'>('appearance')
const open = defineModel<boolean>('open', {required: true})

const tabs = computed(() => [
  {label: $ts('theme.appearance'), value: 'appearance', slot: 'appearance', icon: 'i-lucide-palette'},
  {label: $ts('theme.layout'), value: 'layout', slot: 'layout', icon: 'i-lucide-layout-dashboard'},
  {label: $ts('theme.general'), value: 'general', slot: 'general', icon: 'i-lucide-settings-2'},
  {label: $ts('theme.preset'), value: 'preset', slot: 'preset', icon: 'i-lucide-settings-2'}
])

const configSnapshot = computed(() => {
  const { general, ...layout } = themeStore.getLayoutSettingsSnapshot()

  return {
    layout,
    general,
    theme: {
      radius: appConfig.theme.radius,
      blackAsPrimary: appConfig.theme.blackAsPrimary,
      colors: { ...appConfig.theme.colors }
    },
    colorMode: colorMode.preference
  }
})

async function copyConfig() {
  const text = JSON.stringify(configSnapshot.value, null, 2)

  if (!navigator.clipboard?.writeText) {
    return
  }

  try {
    await navigator.clipboard.writeText(text)
    toast.add({
      title: $ts('common.copySuccess'),
      color: 'success'
    })
  } catch {
    toast.add({
      title: $ts('common.error'),
      color: 'error'
    })
  }
}

function resetConfig() {
  themeStore.resetLayoutSettings()

  appConfig.theme.radius = 0.25
  resetBlackAsPrimary()
  resetThemeColors()
  colorMode.preference = 'system'

  if (import.meta.client) {
    window.localStorage.removeItem('nuxt-ui-radius')
    window.localStorage.removeItem('nuxt-ui-color-mode')
  }

  toast.add({
    title: $ts('theme.configOperation.resetSuccessMsg'),
    color: 'success'
  })
}
</script>

<template>
  <USlideover
      v-model:open="open"
      side="right"
      :ui="{
        content: 'w-[36rem] max-w-[calc(100vw-1rem)]',
        body: 'flex-1 min-h-0 overflow-hidden p-0 sm:p-0',
        footer: 'shrink-0 border-t border-default p-0 sm:p-0'
      }"
  >
    <template #default>
      <slot name="trigger"/>
    </template>

    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-default">
            {{ $ts('theme.appearance') }}
          </p>
        </div>
      </div>
    </template>

    <template #body>
      <div class="flex h-full min-h-0 flex-col">
        <div class="shrink-0 p-4 pb-3">
          <UTabs v-model="activeTab" :items="tabs" color="primary" class="w-full" />
        </div>

        <UScrollArea class="min-h-0 flex-1">
          <div class="px-4 pb-4">
            <ThemeAppearance v-if="activeTab === 'appearance'" />
            <ThemeLayout v-if="activeTab === 'layout'" />
            <ThemeGeneral v-if="activeTab === 'general'" />
            <ThemePreset v-if="activeTab === 'preset'" />
          </div>
        </UScrollArea>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-3 p-4">
        <UButton
          color="error"
          variant="outline"
          :label="$ts('theme.configOperation.resetConfig')"
          @click="resetConfig"
        />
        <UButton
          color="primary"
          :label="$ts('theme.configOperation.copyConfig')"
          @click="copyConfig"
        />
      </div>
    </template>
  </USlideover>
</template>
