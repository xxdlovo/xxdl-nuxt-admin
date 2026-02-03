<script setup lang="ts">
const { $getLocales, $t } = useI18n()
import colors from 'tailwindcss/colors'
import { omit } from '#ui/utils'
import BaseThemePickerButton from './BaseThemePickerButton.vue'

const appConfig = useAppConfig()
const colorMode = useColorMode()

const neutralColors = ['slate', 'gray', 'zinc', 'neutral', 'stone']
const neutral = computed({
  get() {
    return appConfig.ui.colors.neutral
  },
  set(option) {

    appConfig.ui.colors.neutral = option
    window.localStorage.setItem('nuxt-ui-neutral', appConfig.ui.colors.neutral)
  }
})

const colorsToOmit = ['inherit', 'current', 'transparent', 'black', 'white', ...neutralColors]
const primaryColors = Object.keys(omit(colors, colorsToOmit as any))
const primary = computed({
  get() {
    return appConfig.ui.colors.primary
  },
  set(option) {
    appConfig.ui.colors.primary = option
    window.localStorage.setItem('nuxt-ui-primary', appConfig.ui.colors.primary)
    setBlackAsPrimary(false)
  }
})

const radiuses = [0, 0.125, 0.25, 0.375, 0.5]
const radius = computed({
  get() {
    return appConfig.theme.radius
  },
  set(option) {
    appConfig.theme.radius = option
    window.localStorage.setItem('nuxt-ui-radius', String(appConfig.theme.radius))
  }
})

const modes = computed(() => [
  { label: $t('theme.themeSchema.light') as string, value: 'light', icon: appConfig.ui.icons.light },
  { label: $t('theme.themeSchema.dark') as string, value: 'dark', icon: appConfig.ui.icons.dark },
  { label: $t('theme.themeSchema.auto') as string, value: 'system', icon: appConfig.ui.icons.system }
])
const mode = computed({
  get() {
    return colorMode.value
  },
  set(option) {
    colorMode.preference = option
    console.log('set', option);
    window.localStorage.setItem('nuxt-ui-color-mode', option)

  }
})

function setBlackAsPrimary(value: boolean) {
  appConfig.theme.blackAsPrimary = value
  window.localStorage.setItem('nuxt-ui-black-as-primary', String(value))
}
function getDefaultValue() {
  if (typeof window === 'undefined') {
    // SSR 阶段，直接返回默认值
    return
  }
  const savedPrimary = window.localStorage.getItem('nuxt-ui-primary')
  const savedNeutral = window.localStorage.getItem('nuxt-ui-neutral')
  const savedRadius = window.localStorage.getItem('nuxt-ui-radius')
  const savedColorMode = window.localStorage.getItem('nuxt-ui-color-mode')

  if (savedPrimary) primary.value = savedPrimary
  if (savedNeutral) neutral.value = savedNeutral
  if (savedRadius) radius.value = Number(savedRadius)
  if (savedColorMode) mode.value = savedColorMode
}
onBeforeMount(() => {
  getDefaultValue()
})

</script>

<template>
  <UPopover :ui="{ content: 'w-72 px-6 py-4 flex flex-col gap-4' }">
    <template #default="{ open }">
      <UButton icon="i-lucide-swatch-book" color="neutral" :variant="open ? 'soft' : 'ghost'" square
        aria-label="Color picker" :ui="{ leadingIcon: 'text-primary' }" />
    </template>

    <template #content>
      <fieldset>
        <legend class="text-[11px] leading-none font-semibold mb-2">
          {{ $t('theme.themeColor.primary') }}
        </legend>

        <div class="grid grid-cols-3 gap-1 -mx-2">
          <BaseThemePickerButton label="Black" :selected="appConfig.theme.blackAsPrimary" @click="setBlackAsPrimary(true)">
            <template #leading>
              <span class="inline-block w-2 h-2 rounded-full bg-black dark:bg-white" />
            </template>
          </BaseThemePickerButton>

          <BaseThemePickerButton v-for="color in primaryColors" :key="color" :label="color" :chip="color.toLowerCase()"
            :selected="!appConfig.theme.blackAsPrimary && primary === color" @click="primary = color" />
        </div>
      </fieldset>

      <fieldset>
        <legend class="text-[11px] leading-none font-semibold mb-2">
          {{ $t('theme.themeColor.info') }}
        </legend>

        <div class="grid grid-cols-3 gap-1 -mx-2">
          <BaseThemePickerButton v-for="color in neutralColors" :key="color" :label="color"
            :chip="color === 'neutral' ? 'old-neutral' : color" :selected="neutral === color"
            @click="neutral = color" />
        </div>
      </fieldset>

      <fieldset>
        <legend class="text-[11px] leading-none font-semibold mb-2">
          {{ $t('theme.radius') }}
        </legend>

        <div class="grid grid-cols-5 gap-1 -mx-2">
          <BaseThemePickerButton v-for="r in radiuses" :key="r" :label="String(r)" class="justify-center px-0"
            :selected="radius === r" @click="radius = r" />
        </div>
      </fieldset>

      <fieldset>
        <legend class="text-[11px] leading-none font-semibold mb-2">
          {{ $t('theme.themeSchema.title') }}
        </legend>

        <div class="grid grid-cols-3 gap-1 -mx-2">
          <BaseThemePickerButton v-for="m in modes" :key="m.value" v-bind="m" :selected="colorMode.preference === m.value"
            @click="mode = m.value" />
        </div>
      </fieldset>
    </template>
  </UPopover>
</template>