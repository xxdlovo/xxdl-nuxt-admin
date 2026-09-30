<script setup lang="ts">
definePageMeta({ layout: 'docs' })

// `/docs` 只保留为兼容旧链接的入口。官方 Nuxt Content 文档将主入口
// 定向到第一个文档分组，因此这里统一前往 `/docs/getting-started`。
await navigateTo('/docs/getting-started', { replace: true })
</script>

<template>
  <div class="h-24" aria-busy="true" />
</template>
