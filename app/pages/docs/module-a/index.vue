<script setup lang="ts">
definePageMeta({
  layout: 'docs',
  // 与默认系统文档一致，Module A 的 Markdown 查询和嵌套 UPage 不参与页面过渡。
  pageTransition: false
})

// doc/moduleA/index.md 在 moduleA 集合内的路径是 `/`。
// 入口页直接渲染根文档，不再跳转到默认系统文档的 /docs/main/getting-started。
const contentPath = '/'
</script>

<template>
  <DocsModuleAContentPage :content-path="contentPath" />
</template>
