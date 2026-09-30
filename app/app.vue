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
const { $pinia } = useNuxtApp()

// 根组件的 setup 会在应用启动阶段最早执行。此时若直接调用 useThemeStore()，
// Pinia 只能依赖全局 activePinia 来推断所属实例；在 Nuxt 的插件初始化、
// 开发环境热更新或应用重新挂载的交界时刻，activePinia 可能尚未设置，
// 从而导致页面在访问 /login 前就抛出“no active Pinia”的 500 错误。
//
// @pinia/nuxt 会把已注册到 vueApp 的实例注入为 $pinia。显式传入该实例，
// 使主题 store 始终绑定到当前 Nuxt 应用，而不再依赖全局状态和插件执行顺序。
//
// 当前 pnpm 依赖树会为项目代码和 @pinia/nuxt 解析出不同路径的 Pinia 类型声明。
// 两个实例在运行时是同一个 Pinia API，但 TypeScript 会因其内部 use 属性来自
// 不同声明文件而认为类型不兼容。这里转换为 store 函数声明的首个参数类型，
// 只消除该依赖解析造成的类型重复，不改变传入的运行时实例。
const themeStore = useThemeStore($pinia as unknown as Parameters<typeof useThemeStore>[0])
const { initializeThemeColors } = useThemeColors()

initializeThemeColors()

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
  // 文档页使用异步 Markdown 查询、ContentRenderer 和嵌套 UPage。
  // 根组件会把该值显式传给 NuxtPage，因此仅在页面元数据中关闭过渡还不够；
  // 这里直接排除 /docs 路由，避免 out-in 动画在内容切换期间重复卸载旧 VNode，
  // 导致 parentNode/nextSibling 错误以及正文区域消失。后台页面继续沿用原动画。
  if (route.path === '/docs' || route.path.startsWith('/docs/')) {
    return false
  }

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
    <ClientOnly>
      <BaseWatermark />
    </ClientOnly>
  </UApp>
</template>
