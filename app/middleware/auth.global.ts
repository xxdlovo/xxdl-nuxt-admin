export default defineNuxtRouteMiddleware(async (to) => {
  // 文档及其子页面都是公开的演示内容；使用前缀判断避免新增文档后被登录拦截。
  const isPublicPath = ['/', '/landing', '/login', '/register'].includes(to.path)
    || to.path === '/docs'
    || to.path.startsWith('/docs/')
  const { loggedIn, fetch } = useUserSession()

  if (!loggedIn.value) {
    await fetch()
  }

  if (isPublicPath) {
    if (to.path === '/login' && loggedIn.value) {
      return navigateTo('/system/home')
    }
    return
  }

  if (!loggedIn.value) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  }
})
