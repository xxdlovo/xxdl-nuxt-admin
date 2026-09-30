<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'

// 文档区域使用独立布局，避免复用后台布局时带入登录后的侧边栏和标签页。
// 三个导航入口始终保持可见，方便在测试文档、落地页和后台之间来回跳转。
const route = useRoute()

type DocsCollection = 'content' | 'moduleA'

interface DocsSite {
  collection: DocsCollection
  homePath: string
  routePrefix: string
  title: string
  hideRootFromNavigation: boolean
}

// 每套文档独立对应一个 Content 集合和应用路由前缀。
// 后续新增业务文档时，只需在这里追加站点配置、content.config.ts 的集合和页面路由，
// 而不必再复制整套布局、搜索与左侧导航逻辑。
const defaultDocsSite: DocsSite = {
  collection: 'content',
  // 默认系统文档的路由显式包含 main，与 /docs/module-a/** 并列，
  // 使不同文档集合在浏览器地址、搜索结果和复制链接中均可清楚区分。
  homePath: '/docs/main/getting-started',
  routePrefix: '/docs/main',
  title: 'Nuxt Admin',
  // 默认系统文档的根 index.md 是门户页，左栏从“快速开始”等分组开始显示。
  hideRootFromNavigation: true
}

const moduleADocsSite: DocsSite = {
  collection: 'moduleA',
  homePath: '/docs/module-a',
  routePrefix: '/docs/module-a',
  title: '业务 A 文档',
  // Module A 的 index.md 是当前唯一入口，保留它可使左栏在尚未新增子页时也有可点击项。
  hideRootFromNavigation: false
}

const docsSite = computed<DocsSite>(() => {
  // 必须在默认 /docs 的判断前匹配更具体的 module-a 前缀，
  // 否则 /docs/module-a 会被误当成默认系统文档，查询错误的 Content 集合。
  if (route.path === moduleADocsSite.routePrefix || route.path.startsWith(`${moduleADocsSite.routePrefix}/`)) {
    return moduleADocsSite
  }

  return defaultDocsSite
})

const navigationItems = computed(() => [
  // 文档入口始终指向当前站点的首页，业务文档内部不会意外跳回默认系统文档。
  { label: '文档', to: docsSite.value.homePath, icon: 'i-lucide-book-open' },
  { label: '落地页', to: '/', icon: 'i-lucide-panels-top-left' },
  { label: '进入后台', to: '/system/home', icon: 'i-lucide-layout-dashboard' }
])

// Content 为不同集合生成独立的类型。通过分支调用可保留 Nuxt Content 的集合类型校验，
// 避免把字符串变量直接传给 queryCollectionNavigation 时丢失类型信息。
function querySiteNavigation(collection: DocsCollection) {
  return collection === 'moduleA'
    ? queryCollectionNavigation('moduleA')
    : queryCollectionNavigation('content')
}

function querySiteSearchSections(collection: DocsCollection) {
  const options = {
    // Markdown 中 Shiki 注入的 style 节点不属于正文；搜索时排除它，避免结果片段混入 CSS。
    ignoredTags: ['style']
  }

  return collection === 'moduleA'
    ? queryCollectionSearchSections('moduleA', options)
    : queryCollectionSearchSections('content', options)
}

const { data: navigation } = await useAsyncData(
  () => `docs-navigation-${docsSite.value.collection}`,
  () => querySiteNavigation(docsSite.value.collection),
  // 两个文档站共用 docs 布局。路由在站点之间切换时必须重新查询，
  // 否则布局实例会保留上一个集合的左侧导航。
  { watch: [docsSite] }
)

const { data: searchSections } = await useAsyncData(
  () => `docs-search-sections-${docsSite.value.collection}`,
  () => querySiteSearchSections(docsSite.value.collection),
  // 搜索数据必须与当前站点同步切换，避免 Module A 搜到默认系统文档。
  { watch: [docsSite] }
)

// Content 集合的页面路径都以 `/` 为根，而应用层根据站点挂在不同的路由前缀下。
// 此处递归保留导航树结构，并只在展示导航前添加当前站点的应用路由前缀。
function withDocsPrefix(item: ContentNavigationItem): ContentNavigationItem {
  return {
    ...item,
    path: item.path === '/' ? docsSite.value.routePrefix : `${docsSite.value.routePrefix}${item.path}`,
    children: item.children?.map(withDocsPrefix)
  }
}

const docsNavigation = computed(() => {
  // 默认系统文档的根目录 index.md 是门户内容；Module A 则保留根页，
  // 使新建集合即使暂时只有 index.md 也能在左栏展示入口。
  return (navigation.value || [])
    .filter(item => !docsSite.value.hideRootFromNavigation || item.path !== '/')
    .map(withDocsPrefix)
})

// 桌面端由布局直接渲染导航，移动端则由文档页面渲染折叠目录。
// 通过 provide/inject 共享同一份已转换过路由前缀的数据，防止两个视图的链接规则漂移。
provide('docs-navigation', docsNavigation)

const docsSearchSections = computed(() => {
  // UContentSearch 使用文件 id 作为跳转地址。内容索引中的 id 不带 `/docs`，
  // 因此需要与左侧导航一样补齐当前站点的应用路由前缀，点击搜索结果才能抵达正确页面。
  return (searchSections.value || []).map(section => ({
    ...section,
    id: `${docsSite.value.routePrefix}${section.id}`
  }))
})
</script>

<template>
  <div class="min-h-screen bg-default text-default">
    <header class="sticky top-0 z-50 border-b border-default/80 bg-default/90 backdrop-blur">
      <div class="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap sm:px-6">
        <NuxtLink :to="docsSite.homePath" class="flex min-w-0 items-center gap-3 font-semibold text-highlighted">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
            <UIcon name="i-lucide-book-marked" class="size-5" />
          </span>
          <span class="truncate">{{ docsSite.title }}</span>
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
              <!--
                不要设置 collapsible=false：Nuxt UI 会把该值解释为“多分组目录不可折叠”，
                并禁用所有分组触发器。default-open=true 只会自动展开当前页面所属分组，
                其他分组会因此保持折叠且无法点击，看起来像是目录没有加载。
                保留组件默认的 collapsible=true 后，当前分组仍自动展开，其他分组也可手动展开。
              -->
              <UContentNavigation
                :navigation="docsNavigation"
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
      传入已按当前文档站补齐路由前缀的导航和索引，保证搜索结果与侧栏链接指向同一集合。
    -->
    <UContentSearch
      :navigation="docsNavigation"
      :files="docsSearchSections"
      placeholder="搜索文档"
    />
  </div>
</template>
