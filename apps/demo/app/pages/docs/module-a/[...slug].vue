<script setup lang="ts">
// 该页面位于动态路由目录中。显式导入复用的正文组件，而不是完全依赖 Nuxt
// 自动导入，可让 Vue/TypeScript 在编辑器及增量生成 .nuxt 类型文件期间都能
// 确定组件的 props 类型，避免出现“找不到组件”或 content-path 类型无法推断的报错。
import DocsModuleAContentPage from '~/components/docs/ModuleAContentPage.vue'

definePageMeta({
  layout: 'docs',
  // Module A 的页面同样包含异步 Markdown 查询，关闭过渡以避免切换时卸载旧正文。
  pageTransition: false
})

const route = useRoute()
// 应用路由 /docs/module-a/... 对应 moduleA 集合内的 /...。
// 例如 doc/moduleA/guide.md 的访问地址为 /docs/module-a/guide。
// 指定计算结果为 string，避免动态路由切换时 Volar 将模板绑定误判为
// ComputedRef<unknown>，进而在传给 content-path 这个字符串 props 时报告类型错误。
const contentPath = computed<string>(() => route.path.replace(/^\/docs\/module-a(?=\/|$)/, '') || '/')
</script>

<template>
  <DocsModuleAContentPage :content-path="contentPath" />
</template>
