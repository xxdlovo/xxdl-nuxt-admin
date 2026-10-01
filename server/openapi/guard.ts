import type { H3Event } from 'h3'
import { createContext } from '#server/trpc/context'
import { authService } from '#server/sys-router/auth/AuthService'
import { buildPermissionCode } from '#shared/auth'

/**
 * OpenAPI 文档端点的权限码。
 *
 * 与页面的 sys_menu.code 一致，因此「分配了该菜单的角色」即可查看文档。
 * 未在 sys_menu 中登记该权限码时，只有管理员能访问。
 */
export const OPENAPI_PERMISSION_CODE = buildPermissionCode('system:openapi', 'list')

/**
 * 校验文档访问权限。失败时抛 H3 错误，调用方无需再处理。
 *
 * 规则：
 * - NUXT_OPENAPI_ENABLED=false 时整体关闭（404，避免暴露端点存在性）；
 * - 未登录 401；
 * - 非生产环境只要登录即可（方便本地调试）；
 * - 生产环境要求管理员，或拥有 OPENAPI_PERMISSION_CODE。
 */
export async function assertOpenApiAccess(event: H3Event) {
    const config = useRuntimeConfig(event)

    if (config.openapiEnabled === false) {
        throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Not Found' })
    }

    const ctx = await createContext(event)
    const user = ctx.user

    if (!user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized', message: 'Unauthorized' })
    }

    if (process.env.NODE_ENV !== 'production') {
        return ctx
    }

    if (user.isAdmin === 1) {
        return ctx
    }

    const permissionCodes = await authService(ctx).listPermissionCodes(user)

    if (!permissionCodes.includes(OPENAPI_PERMISSION_CODE)) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'Forbidden' })
    }

    return ctx
}
