import type { H3Event } from 'h3'
import { getHeader } from 'h3'
import { timingSafeEqual } from 'node:crypto'
import { createContext, type Context } from '#admin/server/trpc/context'
import { requirePermission } from '#admin/server/utils/routeGuard'
import { verifyCodegenAiToken } from '#admin/server/utils/codegenAiToken'

/**
 * 代码生成 V2 的 AI 接口鉴权。
 *
 * 支持两种方式：
 * 1. Authorization: Bearer <NUXT_CODEGEN_TOKEN>（外部 AI/CLI）
 * 2. 已登录后台会话 + 对应权限码（页面/调试）
 *
 * 令牌只用于 /api/system/gen/ai/** 只读接口，不提供通用文件访问。
 */
export type CodegenAiAccess = {
    ctx: Context
    via: 'token' | 'session'
}

function safeEqual(input: string, expected: string) {
    const actualBuffer = Buffer.from(input)
    const expectedBuffer = Buffer.from(expected)

    if (actualBuffer.length !== expectedBuffer.length) {
        return false
    }

    return timingSafeEqual(actualBuffer, expectedBuffer)
}

export async function requireCodegenAiAccess(
    event: H3Event,
    permission: string
): Promise<CodegenAiAccess> {
    const ctx = await createContext(event)
    const runtimeConfig = useRuntimeConfig(event) as { codegenToken?: string }
    const expected = runtimeConfig.codegenToken ?? ''
    const authorization = getHeader(event, 'authorization') ?? ''
    const token = authorization.replace(/^Bearer\s+/i, '').trim()

    if (expected && token && safeEqual(token, expected)) {
        // 生成配置是系统级元数据，不按部门数据权限过滤
        ctx.skipDataScope = true
        return { ctx, via: 'token' }
    }

    // 列表行「AI」按钮复制的是 15 分钟短期令牌，与长期 NUXT_CODEGEN_TOKEN 等价，
    // 只是不会把长期密钥带进浏览器/对话记录。
    if (token && verifyCodegenAiToken(event, token)) {
        ctx.skipDataScope = true
        return { ctx, via: 'token' }
    }

    await requirePermission(ctx, permission)
    ctx.skipDataScope = true
    return { ctx, via: 'session' }
}
