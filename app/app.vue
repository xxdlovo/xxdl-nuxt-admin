<script setup lang="ts">
import {
  applyThemeColorStyles,
  buildThemeColorStyles,
  resolveColorHex,
  resolveThemeShadeScale,
  themeColorKeys
} from '~/composables/themeColorUtils'

const route = useRoute()
const appConfig = useAppConfig()
const colorMode = useColorMode()
const themeStore = useThemeStore()

const resolvedThemeColors = computed<Record<(typeof themeColorKeys)[number], string>>(() => {
  return Object.fromEntries(
    themeColorKeys.map((key) => {
      const savedColor = appConfig.theme.colors?.[key]
      const fallbackColor = appConfig.ui.colors[key]
      return [key, resolveColorHex(savedColor || fallbackColor)]
    })
  ) as Record<(typeof themeColorKeys)[number], string>
})

const themeColorStyles = computed(() => `@layer theme {\n  :root, :host {\n  ${buildThemeColorStyles(resolvedThemeColors.value)}\n  }\n}`)
const radius = computed(() => `:root { --ui-radius: ${appConfig.theme.radius}rem; }`)
const blackAsPrimary = computed(() => appConfig.theme.blackAsPrimary ? `:root { --ui-primary: black; } .dark { --ui-primary: white; }` : ':root {}')
const themeColor = computed(() => {
  const neutralScale = resolveThemeShadeScale(resolvedThemeColors.value.neutral)
  return colorMode.value === 'dark' ? neutralScale[900] : neutralScale[50]
})
const canonicalPath = computed(() => route.path.replace(/\/+$/, '') || '/')
const pageTransition = computed(() => {
  if (!themeStore.content.pageAnimate || themeStore.content.pageAnimateMode === 'none') {
    return false
  }

  return {
    name: themeStore.content.pageAnimateMode,
    mode: 'out-in'
  } as const
})

watchEffect(() => {
  if (import.meta.client) {
    applyThemeColorStyles(resolvedThemeColors.value)
  }
})

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: themeColor }
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
    { rel: 'canonical', href: `https://ui.nuxt.com${canonicalPath.value}` }
  ],
  style: [
    { innerHTML: radius, id: 'nuxt-ui-radius', tagPriority: -2 },
    { innerHTML: blackAsPrimary, id: 'nuxt-ui-black-as-primary', tagPriority: -2 },
    { innerHTML: themeColorStyles, id: 'nuxt-ui-theme-colors', tagPriority: -1 }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})
</script>

<template>
  <UApp :toaster="{ duration: appConfig.toaster.duration }">
    <NuxtLayout>
      <NuxtPage :transition="pageTransition" />
    </NuxtLayout>
  </UApp>
</template>
