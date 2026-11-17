import { readRememberedLogin } from '#admin/server/utils/rememberedLogin'

/**
 * 登录页读取“记住我”的凭据。
 *
 * Cookie 是 HttpOnly，前端无法直接读取；只能通过这个同源接口换取。
 * 未登录时也可访问，因为登录页本身就需要它来预填。
 */
export default defineEventHandler((event) => {
    setHeader(event, 'Cache-Control', 'no-store')

    const remembered = readRememberedLogin(event)
    if (!remembered) {
        return null
    }

    return remembered
})
