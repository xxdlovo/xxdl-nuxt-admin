<script setup lang="ts">
definePageMeta({
  layout: 'docs',
  pageTransition: false
})

// /docs/main 是默认系统文档的命名空间入口。根 Markdown 门户仍可通过
// Content 查询单独展示，但网站导航统一从第一个实际文档分组开始。
await navigateTo('/docs/main/getting-started', { replace: true })
</script>

<template>
  <div class="h-24" aria-busy="true" />
</template>
