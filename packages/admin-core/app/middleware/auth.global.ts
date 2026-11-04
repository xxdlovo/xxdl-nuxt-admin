/**
 * 后台登录守卫。
 *
 * 作为基座层（layer）的一部分，这个中间件会被注入到宿主应用，
 * 因此**不能**假定宿主只有后台页面：业务项目通常还有自己的官网、
 * 文档站、营销页等公开路由。
 *
 * 规则：只有基座自己的后台路由（`/system/**`）需要登录，
 * 其余路径一律放行。这样宿主新增任何页面都不会被误拦截。
 *
 * 如果业务项目把后台挂到别的前缀下，覆盖本文件即可（覆盖后不再接收基座更新）。
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // 后台路由前缀。基座内所有管理页面都位于 /system 下。
  const ADMIN_PREFIX = '/system'

  const isAdminRoute = to.path === ADMIN_PREFIX || to.path.startsWith(`${ADMIN_PREFIX}/`)

  // 非后台路由：只有「已登录用户访问 /login」需要重定向，其余直接放行。
  if (!isAdminRoute) {
    if (to.path === '/login') {
      const { loggedIn, fetch } = useUserSession()
      if (!loggedIn.value) {
        await fetch()
      }
      if (loggedIn.value) {
        return navigateTo(`${ADMIN_PREFIX}/home`)
      }
    }
    return
  }

  const { loggedIn, fetch } = useUserSession()

  if (!loggedIn.value) {
    await fetch()
  }

  if (!loggedIn.value) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath }
    })
  }
})
