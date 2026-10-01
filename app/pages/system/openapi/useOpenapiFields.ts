import { jsonClone } from '#shared/utils/klona'

/**
 * OpenAPI 文档页的入参初值计算。
 *
 * 这些函数同时被页面（选中接口时生成初始入参）和字段表单（勾选某个字段时生成初值）使用。
 * 初值的取材顺序与 server/openapi/buildDocument.ts 的 sampleFromSchema 保持一致：
 * default → example → enum 首项 → 按类型给空值。
 */
export type JsonSchema = Record<string, any>

/** 文档端点（由 /api/openapi.json 解析而来）。 */
export type OpenApiEndpoint = {
    id: string
    method: string
    path: string
    tag: string
    summary: string
    description: string
    permission?: string
    trpcPath?: string
    trpcType?: string
    /** GET 来自 x-trpc-input-schema，POST 来自 requestBody */
    inputSchema?: JsonSchema
    hasInput: boolean
}

export type OpenApiEndpointGroup = {
    tag: string
    endpoints: OpenApiEndpoint[]
}

const MAX_INITIAL_DEPTH = 3

/** 该 schema 能否渲染成「字段多选」表单。 */
export function isFieldObjectSchema(schema?: JsonSchema): boolean {
    return Boolean(schema && schema.type === 'object' && schema.properties
        && Object.keys(schema.properties).length > 0)
}

/** 单个字段的初值。 */
export function initialFieldValue(schema: JsonSchema, depth = 0): unknown {
    if ('default' in schema) {
        return jsonClone(schema.default)
    }

    if ('example' in schema) {
        return jsonClone(schema.example)
    }

    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
        return schema.enum[0]
    }

    const type = schema.type ?? (schema.properties ? 'object' : undefined)

    switch (type) {
        case 'boolean':
            return false
        case 'integer':
        case 'number':
            return 0
        case 'string':
            return schema.format === 'date-time' ? '2025-01-01T00:00:00.000Z' : ''
        case 'array':
            return []
        case 'object': {
            if (depth >= MAX_INITIAL_DEPTH) {
                return {}
            }

            const nested: Record<string, unknown> = {}
            const required = new Set<string>(schema.required ?? [])

            for (const [name, raw] of Object.entries(schema.properties ?? {})) {
                if (required.has(name)) {
                    nested[name] = initialFieldValue(raw as JsonSchema, depth + 1)
                }
            }

            return nested
        }
        default:
            return null
    }
}

/**
 * 生成初始入参：**默认勾选必填字段**，以及带 default 的字段。
 *
 * 带 default 的字段一并勾选是因为服务端 zod 会补上默认值，
 * 预先勾选并显示该默认值更接近实际发送的内容；未勾选的字段不会出现在入参里，
 * 对必填项为空的情况由服务端返回 400 校验错误。
 */
export function initialValueFromSchema(schema?: JsonSchema): Record<string, unknown> {
    if (!isFieldObjectSchema(schema)) {
        return {}
    }

    const required = new Set<string>(schema!.required ?? [])
    const value: Record<string, unknown> = {}

    for (const [name, raw] of Object.entries(schema!.properties as Record<string, JsonSchema>)) {
        if (required.has(name) || 'default' in (raw ?? {})) {
            value[name] = initialFieldValue(raw, 1)
        }
    }

    return value
}

/** 全选：把所有字段都带入入参。 */
export function allFieldsValue(schema?: JsonSchema): Record<string, unknown> {
    if (!isFieldObjectSchema(schema)) {
        return {}
    }

    const value: Record<string, unknown> = {}

    for (const [name, raw] of Object.entries(schema!.properties as Record<string, JsonSchema>)) {
        value[name] = initialFieldValue(raw, 1)
    }

    return value
}

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch']

/** 把 OpenAPI 文档拍平成可浏览的端点列表，并按 tag 分组。 */
export function parseEndpoints(document: Record<string, any> | undefined) {
    const endpoints: OpenApiEndpoint[] = []
    const paths = (document?.paths ?? {}) as Record<string, Record<string, any>>

    for (const [path, item] of Object.entries(paths)) {
        for (const [method, rawOperation] of Object.entries(item ?? {})) {
            if (!HTTP_METHODS.includes(method)) {
                continue
            }

            const operation = rawOperation as Record<string, any>
            const requestSchema = operation.requestBody?.content?.['application/json']?.schema as JsonSchema | undefined
            const inputSchema = (operation['x-trpc-input-schema'] as JsonSchema | undefined) ?? requestSchema

            endpoints.push({
                id: String(operation.operationId ?? `${method}_${path}`),
                method,
                path,
                tag: String(operation.tags?.[0] ?? 'other'),
                summary: String(operation.summary ?? path),
                description: String(operation.description ?? ''),
                permission: operation['x-permission'] as string | undefined,
                trpcPath: operation['x-trpc-path'] as string | undefined,
                trpcType: operation['x-trpc-type'] as string | undefined,
                inputSchema,
                hasInput: Boolean(inputSchema && Object.keys(inputSchema).length > 0)
            })
        }
    }

    endpoints.sort((a, b) => {
        if (a.tag !== b.tag) {
            return a.tag.localeCompare(b.tag)
        }

        return a.path.localeCompare(b.path)
    })

    const groups: OpenApiEndpointGroup[] = []

    for (const endpoint of endpoints) {
        const last = groups[groups.length - 1]

        if (last && last.tag === endpoint.tag) {
            last.endpoints.push(endpoint)
        }
        else {
            groups.push({ tag: endpoint.tag, endpoints: [endpoint] })
        }
    }

    return { endpoints, groups }
}
