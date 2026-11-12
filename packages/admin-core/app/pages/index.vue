<script setup lang="ts">
/**
 * 根路径的默认落地页。
 *
 * 基座本身没有「首页」业务：后台入口是 `/system/home`，登录入口是 `/login`。
 * 但新建的宿主项目默认从 `/` 开始访问，如果没有这个文件就会直接 404。
 *
 * 这里按登录态做一次重定向。宿主项目如果自己写了 `app/pages/index.vue`，
 * 会按 Layer 优先级覆盖本文件，因此不存在冲突。
 */
const { loggedIn, fetch } = useUserSession()

if (!loggedIn.value) {
  await fetch()
}

await navigateTo(loggedIn.value ? '/system/home' : '/login', { replace: true })
</script>

<template>
  <div />
</template>
