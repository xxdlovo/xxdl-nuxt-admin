export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/' || to.path === '/landing') {
    to.meta.layout = 'landing'
    return
  }

  if (!to.path.startsWith('/system') && to.path !== '/demo' && !to.path.startsWith('/show-case')) {
    to.meta.layout = false
  }
})
