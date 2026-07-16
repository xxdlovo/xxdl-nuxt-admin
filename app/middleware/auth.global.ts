export default defineNuxtRouteMiddleware(async (to) => {
  const publicPaths = ['/login']
  const { loggedIn, fetch } = useUserSession()

  if (!loggedIn.value) {
    await fetch()
  }

  if (publicPaths.includes(to.path)) {
    if (loggedIn.value) {
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
