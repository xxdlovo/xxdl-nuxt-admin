export default defineNuxtRouteMiddleware(async (to) => {
  // 非系统页面不应用布局（直接渲染裸页面）
  if (!to.path.startsWith('/system') && to.path !== '/demo') {
    to.meta.layout = false
  }
  // 系统页面由页面自身的 definePageMeta({ layout: 'system' }) 声明
});