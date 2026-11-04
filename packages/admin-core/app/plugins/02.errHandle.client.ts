import { defineNuxtPlugin } from '#app'
import { useRouter } from 'vue-router'

export default defineNuxtPlugin((nuxtApp) => {
  // 获取已注册的 tRPC 客户端实例
const { $trpc } = useNuxtApp()
  const  toast = useToast()
  const router = useRouter()

  if (!$trpc) {
    console.warn('tRPC 客户端未注册，请先确保 $trpc 已正确挂载')
    return
  }
 
})
    