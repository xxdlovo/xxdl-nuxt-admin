<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'

// 文档区域使用独立布局，避免复用后台布局时带入登录后的侧边栏和标签页。
// 三个导航入口始终保持可见，方便在测试文档、落地页和后台之间来回跳转。
const navigationItems = [
  // 与 Nuxt Content 官方站点一致，文档入口直接进入第一个文档分组，
  // 而不是停留在 /docs 这个仅负责分流的入口地址。
  { label: '文档', to: '/docs/getting-started', icon: 'i-lucide-book-open' },
  { label: '落地页', to: '/', icon: 'i-lucide-panels-top-left' },
  { label: '进入后台', to: '/system/home', icon: 'i-lucide-layout-dashboard' }
]

const { data: navigation } = await useAsyncData(
  'docs-navigation',
  () => queryCollectionNavigation('content')
)

const { data: searchSections } = await useAsyncData(
  'docs-search-sections',
  () => queryCollectionSearchSections('content', {
    // Markdown 中 Shiki 注入的 style 节点不属于正文；搜索时排除它，避免结果片段混入 CSS。
    ignoredTags: ['style']
  })
)

// Content 集合的页面路径以 `/` 为根，但应用层将文档统一挂在 `/docs` 下。
// 此处递归保留导航树结构，并只在展示导航前添加应用路由前缀。
function withDocsPrefix(item: ContentNavigationItem): ContentNavigationItem {
  return {
    ...item,
    path: item.path === '/' ? '/docs' : `/docs${item.path}`,
    children: item.children?.map(withDocsPrefix)
  }
}

const docsNavigation = computed(() => {
  // 根目录 index.md 是文档门户内容，不显示为侧栏条目；侧栏从“快速开始”等分组开始。
  return (navigation.value || [])
    .filter(item => item.path !== '/')
    .map(withDocsPrefix)
})

// 桌面端由布局直接渲染导航，移动端则由文档页面渲染折叠目录。
// 通过 provide/inject 共享同一份已转换过路由前缀的数据，防止两个视图的链接规则漂移。
provide('docs-navigation', docsNavigation)

const docsSearchSections = computed(() => {
  // UContentSearch 使用文件 id 作为跳转地址。内容索引中的 id 不带 `/docs`，
  // 因此需要与左侧导航一样补齐应用路由前缀，点击搜索结果才能抵达正确页面。
  return (searchSections.value || []).map(section => ({
    ...section,
    id: `/docs${section.id}`
  }))
})
</script>

<template>
  <div class="min-h-screen bg-default text-default">
    <header class="sticky top-0 z-50 border-b border-default/80 bg-default/90 backdrop-blur">
      <div class="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap sm:px-6">
        <NuxtLink to="/docs/getting-started" class="flex min-w-0 items-center gap-3 font-semibold text-highlighted">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
            <UIcon name="i-lucide-book-marked" class="size-5" />
          </span>
          <span class="truncate">Nuxt Content Demo</span>
        </NuxtLink>

        <nav aria-label="文档导航" class="flex w-full items-center justify-end gap-1 sm:w-auto sm:gap-2">
          <!-- 搜索按钮与 UContentSearch 通过 Nuxt UI 的共享状态连接，支持 Ctrl/Cmd + K。 -->
          <UContentSearchButton
            label="搜索"
            :collapsed="false"
            class="hidden md:inline-flex"
          />
          <UContentSearchButton
            :collapsed="true"
            class="md:hidden"
          />

          <!-- Nuxt UI 已集成 color-mode；该按钮会持久化用户选择并在明暗模式间切换。 -->
          <UTooltip text="切换颜色模式">
            <UColorModeButton />
          </UTooltip>

          <!-- 直接使用 NuxtLink，确保“文档”与其他导航项始终渲染为可点击的链接。 -->
          <NuxtLink
            v-for="item in navigationItems"
            :key="item.to"
            :to="item.to"
            class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-sm text-muted transition-colors hover:bg-elevated hover:text-highlighted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <UIcon :name="item.icon" class="size-4" />
            {{ item.label }}
          </NuxtLink>
        </nav>
      </div>
    </header>

    <UMain>
      <UContainer>
        <UPage>
          <template #left>
            <UPageAside>
              <div class="mb-5 flex items-center gap-2 px-2 text-sm font-semibold text-highlighted lg:px-0">
                <UIcon name="i-lucide-panel-left" class="size-4 text-primary" />
                <span>文档目录</span>
              </div>
              <UContentNavigation
                :navigation="docsNavigation"
                :collapsible="false"
                :default-open="true"
                variant="link"
                highlight
                class="w-full"
              />
            </UPageAside>
          </template>

          <!--
            与 Docus 一致，外层 UPage 只负责左侧全站导航。
            每个文档页面会在 slot 内创建自己的 UPage，以便单独控制正文和右侧页内目录。
          -->
          <slot />
        </UPage>
      </UContainer>
    </UMain>

    <!--
      搜索弹窗必须实际挂载在页面中，UContentSearchButton 只负责切换它的共享打开状态。
      传入已经补齐 `/docs` 前缀的导航和索引，保证搜索结果与侧栏链接指向同一路由。
    -->
    <UContentSearch
      :navigation="docsNavigation"
      :files="docsSearchSections"
      placeholder="搜索文档"
    />
  </div>
</template>
