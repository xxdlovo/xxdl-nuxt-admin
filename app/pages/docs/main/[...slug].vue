<script setup lang="ts">
import type { ContentNavigationItem, TocLink } from '@nuxt/content'
import type { Ref } from 'vue'

definePageMeta({
  layout: 'docs',
  // 文档页包含异步 ContentRenderer 和嵌套 UPage。关闭全局 out-in 动画，
  // 避免切换 Markdown 页面时旧的异步 VNode 尚未卸载完成，新页面又开始更新，
  // 从而触发 Vue 的 parentNode/nextSibling 错误并导致正文消失。
  pageTransition: false
})

const route = useRoute()
// 应用路由前缀不属于 Nuxt Content 的路径。
// 例如 /docs/main/getting-started/installation 对应内容路径 /getting-started/installation。
const contentPath = computed(() => route.path.replace(/^\/docs\/main(?=\/|$)/, '') || '/')

const { data: page } = await useAsyncData(
  () => `docs-${contentPath.value}`,
  () => queryCollection('content').path(contentPath.value).first()
)

const { data: surround } = await useAsyncData(
  () => `docs-surround-${contentPath.value}`,
  () => queryCollectionItemSurroundings('content', contentPath.value, {
    // 前后页卡片只需要展示摘要，不额外传输或渲染完整 Markdown 正文。
    fields: ['description']
  })
)

const tocLinks = computed<TocLink[]>(() => {
  const body = page.value?.body as { toc?: { links?: TocLink[] } } | undefined
  return body?.toc?.links || []
})

function withDocsPrefix(item: ContentNavigationItem): ContentNavigationItem {
  return {
    ...item,
    // 前后页数据来自 Content 集合，路径不含应用层 `/docs/main` 前缀；
    // 统一转换后，UContentSurround 生成的链接才能由 Nuxt 文件路由匹配。
    path: item.path === '/' ? '/docs/main' : `/docs/main${item.path}`,
    children: item.children?.map(withDocsPrefix)
  }
}

const docsSurround = computed(() => {
  // `queryCollectionItemSurroundings` 会固定返回前一页和后一页两个位置。
  // 当前页面位于文档开头或结尾时，其中一个位置是 null；必须先过滤，
  // 否则路由切换时 withDocsPrefix 会读取 null.path 并中断整个正文渲染。
  return (surround.value || [])
    .filter((item): item is ContentNavigationItem => Boolean(item?.path))
    .map(withDocsPrefix)
})

const docsNavigation = inject<Ref<ContentNavigationItem[]>>('docs-navigation', ref([]))

useSeoMeta({
  title: () => page.value?.title || '文档',
  description: () => page.value?.description || 'Nuxt Content 测试文档页面'
})
</script>

<template>
  <div class="min-w-0">
    <!--
      NuxtPage 启用了页面过渡，路由页面必须只有一个实际根节点。
      之前的 template v-if 与 UAlert 形成 Fragment，切换子路由时 Vue 会卸载正文，
      因而页面只剩左右侧栏。此根容器保证过渡期间正文始终可正常挂载。

      注释也必须置于容器内：开发环境会保留根级注释 VNode，若它与 div 并列，
      Nuxt 仍会将页面判定为多根节点并再次触发页面过渡告警。
    -->
    <UPage v-if="page" :key="contentPath">
      <!--
        UPageAside 会在 lg 以下隐藏。这里提供与桌面左栏完全相同的折叠导航，
        使手机和小尺寸窗口仍可在文档分组间跳转，而不必返回顶部“文档”入口。
      -->
      <div class="mb-6 lg:hidden">
        <details class="rounded-lg border border-default bg-elevated p-3">
          <summary class="cursor-pointer font-medium text-highlighted">文档目录</summary>
          <!--
            与桌面端导航使用相同的可展开规则。不能传入 collapsible=false，
            否则 Nuxt UI 会禁用每个有 children 的目录分组，使非当前分组无法展开。
          -->
          <UContentNavigation
            :navigation="docsNavigation"
            :default-open="true"
            variant="link"
            highlight
            class="mt-4"
          />
        </details>
      </div>

      <UPageHeader
        :title="page.title"
        :description="page.description"
      />

      <UPageBody>
        <ContentRenderer :value="page" class="docs-content" />

        <!-- 空数组不会显示无效链接，避免首篇或末篇文档下方留下多余分隔区。 -->
        <USeparator v-if="docsSurround.length" />
        <UContentSurround
          v-if="docsSurround.length"
          :surround="docsSurround"
        />
      </UPageBody>

      <template #right>
        <!-- UPageAside 在 lg 以上显示并固定，移动端则使用正文上方的折叠目录。 -->
        <UPageAside v-if="tocLinks.length">
          <UContentToc
            title="本页内容"
            :links="tocLinks"
            highlight
            highlight-variant="circuit"
          />
        </UPageAside>
      </template>
    </UPage>

    <UAlert
      v-else
      color="warning"
      variant="subtle"
      title="找不到文档"
      description="这个测试地址没有对应的 Markdown 文件。"
    />
  </div>
</template>
