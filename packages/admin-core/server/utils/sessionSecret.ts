import type { H3Event } from 'h3'

type SessionSecretRuntimeConfig = {
    session?: {
        password?: string
    }
}

/**
 * 读取 session 加密密钥。
 *
 * nuxt-auth-utils 0.5 会把 `NUXT_SESSION_PASSWORD` 注入到
 * `runtimeConfig.session.password`；0.6 起不再注入（`SessionConfig` 也不允许再配置
 * password 字段），只能从环境变量读取。
 *
 * 验证码签名、「记住我」加密、代码生成 AI 短期令牌都派生自这个密钥，
 * 这里统一兼容两种来源，避免升级后这些能力悄悄失效。
 */
export function getSessionSecret(event?: H3Event): string {
    const config = (event ? useRuntimeConfig(event) : useRuntimeConfig()) as SessionSecretRuntimeConfig
    return config.session?.password || process.env.NUXT_SESSION_PASSWORD || ''
}
