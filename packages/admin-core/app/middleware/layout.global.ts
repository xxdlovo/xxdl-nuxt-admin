export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/' || to.path === '/landing') {
    to.meta.layout = 'landing'
    return
  }

})
