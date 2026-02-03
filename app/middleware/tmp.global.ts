export default defineNuxtRouteMiddleware((to, from) => {
    console.log('hello');
    
    if (to.path === '/login' || to.path === '/admin') {
        return
    }else{
        navigateTo('/admin')
    }

})
