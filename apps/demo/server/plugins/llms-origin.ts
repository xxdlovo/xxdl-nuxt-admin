import { getRequestURL } from 'h3'

type LlmsLink = {
    title?: string
    description?: string
    href?: string
}

type LlmsSection = {
    title?: string
    description?: string
    links?: LlmsLink[]
}

type LlmsOptions = {
    domain?: string
    sections?: LlmsSection[]
}

/**
 * 让 `/llms.txt` 使用真实访问域名。
 *
 * nuxt-llms 生成链接时会把 `llms.domain` 拼到每个 `href` 前面。该值来自构建期配置：
 * CI/镜像里没有公网域名时只能是 `http://localhost:3001`，于是线上 llms.txt 里会出现
 * `http://localhost:3001/raw/xxx.md` 这种无法访问的地址。
 *
 * 这里在 `llms:generate`（content 的 llms 插件已把 links 填好之后）用请求的 origin
 * 覆盖掉域名，并同步改写 `domain`，保证 dev（localhost）与线上（真实域名）都正确。
 *
 * 配套：`nuxt.config.ts` 里 `llms.prerender: false` —— 预渲染会把域名固化在构建机上。
 */
export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('llms:generate', (event: unknown, options: LlmsOptions) => {
        let origin = ''

        try {
            origin = getRequestURL(event as Parameters<typeof getRequestURL>[0]).origin
        }
        catch {
            return
        }

        if (!origin) {
            return
        }

        options.domain = origin

        for (const section of options.sections ?? []) {
            for (const link of section.links ?? []) {
                if (typeof link.href === 'string') {
                    link.href = link.href.replace(/^https?:\/\/[^/]+/, origin)
                }
            }
        }
    })
})
