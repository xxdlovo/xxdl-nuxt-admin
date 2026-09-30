export default defineNuxtRouteMiddleware((to) => {
  // 默认系统文档的正式地址均位于 /docs/main/**，业务 A 则位于 /docs/module-a/**。
  // 将旧的 /docs 和 /docs/** 入口集中放在中间件兼容，而不是保留同名页面文件，
  // 使 app/pages/docs/ 的目录结构能准确表达当前两套文档的路由层级。
  if (to.path === '/docs') {
    return navigateTo('/docs/main/getting-started', { replace: true })
  }

  // module-a 与 main 已是规范路径，不能被旧地址迁移规则二次改写。
  if (to.path.startsWith('/docs/main/') || to.path.startsWith('/docs/module-a')) {
    return
  }

  if (to.path.startsWith('/docs/')) {
    // fullPath 同时保留查询参数和锚点，旧的分享链接迁移后仍能定位到原位置。
    return navigateTo(`/docs/main${to.fullPath.slice('/docs'.length)}`, { replace: true })
  }
})
