<script setup lang="ts">
import { withoutTrailingSlash } from 'ufo'
import colors from 'tailwindcss/colors'

const route = useRoute()
const appConfig = useAppConfig()
const colorMode = useColorMode()

const color = computed(() => colorMode.value === 'dark' ? (colors as any)[appConfig.ui.colors.neutral][900] : 'white')
const radius = computed(() => `:root { --ui-radius: ${appConfig.theme.radius}rem; }`)
const blackAsPrimary = computed(() => appConfig.theme.blackAsPrimary ? `:root { --ui-primary: black; } .dark { --ui-primary: white; }` : ':root {}')

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color }
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
    { rel: 'canonical', href: `https://ui.nuxt.com${withoutTrailingSlash(route.path)}` }
  ],
  style: [
    { innerHTML: radius, id: 'nuxt-ui-radius', tagPriority: -2 },
    { innerHTML: blackAsPrimary, id: 'nuxt-ui-black-as-primary', tagPriority: -2 }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

</script>
<template>
  <UApp :toaster="{duration: appConfig.toaster.duration}">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
<script lang="ts" setup>
</script>
