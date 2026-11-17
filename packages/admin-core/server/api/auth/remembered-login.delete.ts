import { clearRememberedLogin } from '#admin/server/utils/rememberedLogin'

/** 取消“记住我”时清除 HttpOnly 凭据。 */
export default defineEventHandler((event) => {
    clearRememberedLogin(event)
    return { success: true }
})
