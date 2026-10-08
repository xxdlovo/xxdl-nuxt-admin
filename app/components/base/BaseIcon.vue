<script setup lang="ts">
/**
 * 渲染「图标名或图片地址」。
 *
 * 第三方平台配置的 `icon` 既可能是 Iconify 图标名（如 `i-simple-icons-github`），
 * 也可能是 `http(s)` 图片地址（如论坛 Logo、CDN 图片），这里统一处理：
 * URL 走 `<img>`，其余交给 `<UIcon>`。
 *
 * 用它的原因：`UButton` 的 `icon` prop 只接受图标名，直接把 URL 传进去不会渲染。
 */
const props = withDefaults(defineProps<{
  /** 图标名（`i-xxx` 或 `集合:名称`）或 `http(s)` 图片地址 */
  name?: string | null
  /** 尺寸类，默认与 UButton 内置图标一致 */
  size?: string
}>(), {
  name: null,
  size: 'size-4'
})

/** 只有 http(s) 开头的才当图片地址，其余按 Iconify 图标名处理 */
const imageUrl = computed(() => {
  const value = props.name?.trim() ?? ''
  return /^https?:\/\//i.test(value) ? value : ''
})
</script>

<template>
  <img
    v-if="imageUrl"
    :src="imageUrl"
    alt=""
    class="rounded-sm object-contain"
    :class="size"
  >
  <UIcon v-else-if="name" :name="name" :class="size" />
</template>
