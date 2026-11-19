import type { H3Event } from 'h3'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { getSessionSecret } from '#admin/server/utils/sessionSecret'

/**
 * 代码生成 V2 的短期访问令牌。
 *
 * 后台列表行的「AI」按钮会把提示词直接复制到剪贴板，提示词里需要带一个
 * CODEGEN_TOKEN 才能让 AI/CLI 直接运行。为了不把长期 NUXT_CODEGEN_TOKEN
 * 暴露到浏览器/对话记录里，默认签发 15 分钟短期令牌，且只被
 * /api/system/gen/ai/** 只读接口接受。
 *
 * 如确实需要复制长期令牌，可设置 NUXT_CODEGEN_COPY_SECRET=true。
 */

const TOKEN_PREFIX = 'cg1'
export const CODEGEN_AI_TOKEN_TTL_MS = 15 * 60 * 1000

type CodegenRuntimeConfig = {
    codegenToken?: string
    session?: {
        password?: string
    }
}

function getSecret(event: H3Event) {
    const config = useRuntimeConfig(event) as CodegenRuntimeConfig
    return getSessionSecret(event) || config.codegenToken || ''
}

function sign(payload: string, secret: string) {
    return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function issueCodegenAiToken(event: H3Event) {
    const secret = getSecret(event)
    if (!secret) {
        return null
    }

    const expiresAt = Date.now() + CODEGEN_AI_TOKEN_TTL_MS
    const payload = `${TOKEN_PREFIX}.${expiresAt}`
    const token = `${payload}.${sign(payload, secret)}`

    return {
        token,
        expiresAt: new Date(expiresAt).toISOString(),
    }
}

export function verifyCodegenAiToken(event: H3Event, token: string) {
    const secret = getSecret(event)
    if (!secret) {
        return false
    }

    const parts = token.split('.')
    if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
        return false
    }

    const expiresAt = Number(parts[1])
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        return false
    }

    const payload = `${parts[0]}.${parts[1]}`
    const expected = sign(payload, secret)
    const actualBuffer = Buffer.from(parts[2] ?? '')
    const expectedBuffer = Buffer.from(expected)

    if (actualBuffer.length !== expectedBuffer.length) {
        return false
    }

    return timingSafeEqual(actualBuffer, expectedBuffer)
}
