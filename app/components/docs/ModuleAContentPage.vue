<script setup lang="ts">
import type { ContentNavigationItem, TocLink } from '@nuxt/content'
import type { Ref } from 'vue'

const props = defineProps<{
  /**
   * Module A 集合内的 Content 路径。集合以自身目录为根，
   * 所以 doc/moduleA/index.md 对应 `/`，子文件对应 `/子路径`。
   */
  contentPath: string
}>()

const moduleARoutePrefix = '/docs/module-a'

const { data: page } = await useAsyncData(
  () => `module-a-docs-${props.contentPath}`,
  () => queryCollection('moduleA').path(props.contentPath).first(),
  // 动态子路由切换时复用该组件，因此监听 prop，确保重新读取对应 Markdown。
  { watch: [() => props.contentPath] }
)

const { data: surround } = await useAsyncData(
  () => `module-a-docs-surround-${props.contentPath}`,
  () => queryCollectionItemSurroundings('moduleA', props.contentPath, {
    // 前后页只显示摘要，不额外传输完整 Markdown 内容。
    fields: ['description']
  }),
  { watch: [() => props.contentPath] }
)

const tocLinks = computed<TocLink[]>(() => {
  const body = page.value?.body as { toc?: { links?: TocLink[] } } | undefined
  return body?.toc?.links || []
})

function withModuleAPrefix(item: ContentNavigationItem): ContentNavigationItem {
  return {
    ...item,
    // collection 内的路径不含应用路由前缀。统一补齐后，前后页链接才会留在 Module A 文档站。
    path: item.path === '/' ? moduleARoutePrefix : `${moduleARoutePrefix}${item.path}`,
    children: item.children?.map(withModuleAPrefix)
  }
}

const docsSurround = computed(() => {
  // 文档开头或结尾会返回 null 占位；先过滤，避免读取 null.path 导致正文渲染中断。
  return (surround.value || [])
    .filter((item): item is ContentNavigationItem => Boolean(item?.path))
    .map(withModuleAPrefix)
})

// docs 布局会按当前路由提供 Module A 集合专属导航；保留空数组作为独立渲染时的安全回退。
const docsNavigation = inject<Ref<ContentNavigationItem[]>>('docs-navigation', ref([]))

useSeoMeta({
  title: () => page.value?.title || '业务 A 文档',
  description: () => page.value?.description || '业务 A 文档页面'
})
</script>

<template>
  <!-- 单根节点避免 Markdown 异步更新时触发 Nuxt 页面过渡的 Fragment 卸载问题。 -->
  <div class="min-w-0">
    <UPage v-if="page" :key="contentPath">
      <div class="mb-6 lg:hidden">
        <details class="rounded-lg border border-default bg-elevated p-3">
          <summary class="cursor-pointer font-medium text-highlighted">文档目录</summary>
          <UContentNavigation
            :navigation="docsNavigation"
            :default-open="true"
            variant="link"
            highlight
            class="mt-4"
          />
        </details>
      </div>

      <UPageHeader :title="page.title" :description="page.description" />

      <UPageBody>
        <ContentRenderer :value="page" class="docs-content" />

        <USeparator v-if="docsSurround.length" />
        <UContentSurround
          v-if="docsSurround.length"
          :surround="docsSurround"
        />
      </UPageBody>

      <template #right>
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
      title="找不到业务 A 文档"
      description="这个地址没有对应的 Module A Markdown 文件。"
    />
  </div>
</template>
