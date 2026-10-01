import { buildOpenApiDocument } from '#server/openapi/buildDocument'
import { assertOpenApiAccess } from '#server/openapi/guard'

/**
 * OpenAPI 3.0 文档端点：GET /api/openapi.json
 *
 * 每次请求实时生成，保证文档与代码一致；因此不做服务端缓存。
 * 访问控制见 server/openapi/guard.ts。
 */
export default defineEventHandler(async (event) => {
    await assertOpenApiAccess(event)

    const requestUrl = getRequestURL(event)
    const appName = useRuntimeConfig(event).public.appName as string | undefined

    const { document } = buildOpenApiDocument({
        servers: [{ url: requestUrl.origin, description: '当前实例' }],
        title: appName ? `${appName} API` : undefined
    })

    setHeader(event, 'cache-control', 'no-store')

    return document
})
