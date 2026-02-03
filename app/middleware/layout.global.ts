export default defineNuxtRouteMiddleware(async (to) => {
    
  if (to.path.startsWith('/system')) {
      // 系统模块使用系统布局
    to.meta.layout = 'system'
  }else if (to.path === '/login' || to.path === '/register') {
      // 登录/注册使用无布局
    to.meta.layout = false
  } else {
    to.meta.layout = false
  }
});