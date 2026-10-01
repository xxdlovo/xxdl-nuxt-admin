import { z } from 'zod'
import { appRouter } from '#server/trpc/routers'
import { toOpenApiSchema } from './schema'
import { inferResponseSchema } from './responseSchemas'
import { manualDefs, manualPaths, manualTag, manualTagName } from './manualRoutes'

/**
 * 遍历 appRouter 生成 OpenAPI 3.0.3 文档。
 *
 * 生成过程是纯静态的：不调用任何 Service，不访问数据库，
 * 只读取 procedure 的 `.input()` schema 与 `.meta()` 声明。
 */

/** procedure 级文档增强声明：.meta({ openapi: {...} }) */
export type TrpcOpenApiMeta = {
    summary?: string
    description?: string
    tags?: string[]
    /** 覆盖默认方法（默认统一用 post） */
    method?: 'get' | 'post' | 'put' | 'delete' | 'patch'
    /** 覆盖默认路径（默认 /api/trpc/<router>.<proc>） */
    path?: string
    /** 从文档中隐藏该接口 */
    hidden?: boolean
    /** 手工指定 200 响应体的业务数据 schema，覆盖自动推断 */
    responseSchema?: z.ZodType
}

type ProcedureLike = {
    _def: {
        type?: string
        inputs?: unknown[]
        meta?: Record<string, unknown>
    }
}

export type OpenApiServer = {
    url: string
    description?: string
}

export type BuildOpenApiOptions = {
    servers?: OpenApiServer[]
    title?: string
    version?: string
    description?: string
}

export type OpenApiCoverage = {
    /** tRPC procedure 总数（不含原生路由） */
    total: number
    /** 200 响应 schema 推断成功的数量 */
    inferred: number
    bySource: Record<string, number>
    /** 未能推断出响应 schema 的接口，附原因 */
    missing: string[]
}

export type BuildOpenApiResult = {
    document: Record<string, unknown>
    warnings: string[]
    coverage: OpenApiCoverage
}

export const TRPC_ENDPOINT_PREFIX = '/api/trpc/'

const DEFAULT_TITLE = 'Nuxt Admin System API'
const DEFAULT_VERSION = '1.0.0'

/**
 * tRPC 的错误响应体。
 *
 * 结构来自 @trpc/server 的错误序列化 + 本项目的 errorFormatter：
 * 后者在 shape.data 上追加 type / message / i18nKey / httpStatus。
 * 参考 server/trpc/errorFormatter.ts 与 shared/types/common/TRPCFormattedError.ts。
 */
const trpcErrorSchema = {
    type: 'object',
    properties: {
        error: {
            type: 'object',
            properties: {
                message: { type: 'string', description: '已按请求语言翻译的错误消息' },
                code: { type: 'number', description: 'JSON-RPC 错误码' },
                data: {
                    type: 'object',
                    properties: {
                        code: { type: 'string', description: 'tRPC 错误码，例如 BAD_REQUEST / UNAUTHORIZED / FORBIDDEN' },
                        httpStatus: { type: 'number' },
                        type: { type: 'string', description: '已翻译的错误类型描述' },
                        i18nKey: { type: 'string', description: 'AppError 的原始 i18n key，供前端分支处理' },
                        stack: { type: 'string', description: '堆栈，仅开发环境返回' }
                    }
                }
            },
            required: ['message', 'code']
        }
    },
    required: ['error']
}

function trpcErrorResponse(description: string) {
    return {
        description,
        content: {
            'application/json': {
                schema: trpcErrorSchema
            }
        }
    }
}

/** 把推断出的业务数据结构包装成 tRPC 的 HTTP 响应体：`{ result: { data } }`。 */
function trpcResultEnvelope(dataSchema: Record<string, unknown>) {
    return {
        type: 'object',
        properties: {
            result: {
                type: 'object',
                properties: {
                    data: dataSchema
                },
                required: ['data']
            }
        },
        required: ['result']
    }
}

/**
 * 从 JSON Schema 生成一个可直接粘贴的入参示例。
 *
 * 用于 GET 类接口的 `input` 查询参数（tRPC 要求把整个入参序列化成 JSON 字符串），
 * 让 Swagger UI 的 Try it out 有个能直接用的初值。
 */
function sampleFromSchema(schema: Record<string, unknown>, depth = 0): unknown {
    if (!schema || depth > 4) {
        return null
    }

    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
        return schema.enum[0]
    }

    if ('example' in schema) {
        return schema.example
    }

    if ('default' in schema) {
        return schema.default
    }

    const type = typeof schema.type === 'string'
        ? schema.type
        : (schema.properties ? 'object' : undefined)

    switch (type) {
        case 'object': {
            const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>
            const sample: Record<string, unknown> = {}

            for (const [key, value] of Object.entries(properties)) {
                sample[key] = sampleFromSchema(value, depth + 1)
            }

            return sample
        }
        case 'array':
            return [sampleFromSchema((schema.items ?? {}) as Record<string, unknown>, depth + 1)]
        case 'string':
            return schema.format === 'date-time' ? '2025-01-01T00:00:00.000Z' : 'string'
        case 'integer':
        case 'number':
            return 0
        case 'boolean':
            return true
        default:
            return null
    }
}

/** 生成本次调用的等价 curl 示例，写进 operation description。 */
function buildProcedureDescription(
    procedurePath: string,
    method: string,
    meta: Record<string, unknown>,
    inputExample?: string
) {
    const url = `${TRPC_ENDPOINT_PREFIX}${procedurePath}`
    const lines = [`tRPC procedure：\`${procedurePath}\`（\`${meta.trpcType ?? 'query'}\`）`, '']

    if (method === 'get') {
        lines.push(
            'tRPC 只允许用 GET 调用 query 类型的 procedure（用 POST 会返回 405 Unsupported POST-request to query procedure）。',
            '入参需要序列化成 JSON 字符串放进 `input` 查询参数：',
            '```bash',
            `curl -G -b "nuxt-session=<cookie>" \\`,
            `  --data-urlencode 'input=${inputExample ?? '{}'}' ${url}`,
            '```',
            '',
            'Swagger UI 的 Try it out 需要你在 `input` 输入框里直接填写这段 JSON。'
        )
    }
    else {
        lines.push(
            'tRPC 只允许用 POST 调用 mutation 类型的 procedure（用 GET 会返回 405 Unsupported GET-request to mutation procedure）。',
            '请求体就是入参 JSON 本身：',
            '```bash',
            'curl -X POST -H "content-type: application/json" \\',
            `  -b "nuxt-session=<cookie>" -d '${inputExample ?? '{}'}' ${url}`,
            '```'
        )
    }

    lines.push(
        '',
        '响应统一包在 `result.data` 中；出错时返回 `{ error: { message, code, data } }`，HTTP 状态码见 responses。'
    )

    if (meta.auth === 'public') {
        lines.push('', '鉴权：公开接口，无需登录。')
    }
    else {
        lines.push('', '鉴权：需要登录（`nuxt-session` Cookie）。')
    }

    if (typeof meta.permission === 'string' && meta.permission) {
        lines.push(`权限码：\`${meta.permission}\`（管理员直通，其余用户需在角色中分配）。`)
    }
    else if (meta.auth !== 'public') {
        lines.push('权限码：只需登录，无额外权限码校验。')
    }

    if (meta.readonly === true) {
        lines.push('')
        lines.push('注意：该接口在 demo 模式下被只读保护（`NUXT_DEMO_MODE=true` 时拒绝执行）。')
    }

    if (meta.log === true) {
        lines.push('操作日志：会写入 `sys_system_log`。')
    }
    else if (meta.log === false) {
        lines.push('操作日志：不记录。')
    }

    if (meta.dataScope === false) {
        lines.push('数据权限：不做数据范围限制（`dataScope: false`）。')
    }

    return lines.join('\n')
}

export function buildOpenApiDocument(options: BuildOpenApiOptions = {}): BuildOpenApiResult {
    const {
        servers,
        title = DEFAULT_TITLE,
        version = DEFAULT_VERSION,
        description = '由 appRouter 与 shared 契约自动生成的接口文档。请求体 schema 来自 procedure 的 .input()，响应体 schema 按命名约定推断（见 x-openapi-response-coverage）。'
    } = options

    const warnings: string[] = []
    const schemas: Record<string, unknown> = { ...manualDefs }
    const paths: Record<string, Record<string, unknown>> = {}
    const tagNames = new Set<string>([manualTagName])

    for (const [path, item] of Object.entries(manualPaths)) {
        paths[path] = { ...item }
    }

    const procedures = (appRouter as unknown as { _def: { procedures: Record<string, ProcedureLike> } })
        ._def.procedures

    const coverage: OpenApiCoverage = {
        total: 0,
        inferred: 0,
        bySource: { rule: 0, special: 0, meta: 0 },
        missing: []
    }

    /** 合并 Zod 抽取出来的 $defs，同名冲突时保留先出现的定义并记录警告。 */
    function mergeDefs(defs: Record<string, Record<string, unknown>>, owner: string) {
        for (const [name, def] of Object.entries(defs)) {
            if (schemas[name]) {
                warnings.push(`${owner}: schema name "${name}" already defined in components.schemas, kept the first one`)
                continue
            }

            schemas[name] = def
        }
    }

    for (const procedurePath of Object.keys(procedures).sort()) {
        const procedure = procedures[procedurePath]
        const meta = (procedure?._def?.meta ?? {}) as Record<string, unknown>
        const openApiMeta = (meta.openapi ?? {}) as TrpcOpenApiMeta

        if (openApiMeta.hidden === true) {
            continue
        }

        const [routerName = procedurePath, ...rest] = procedurePath.split('.')
        const procedureName = rest.join('.')
        const tags = openApiMeta.tags?.length ? openApiMeta.tags : [routerName]

        for (const tag of tags) {
            tagNames.add(tag)
        }

        coverage.total += 1

        // ---------- 方法与入参 ----------
        // tRPC 对 HTTP 方法有硬性约束（已实测）：query 只能用 GET，mutation 只能用 POST，
        // 用错方法会返回 405 METHOD_NOT_SUPPORTED
        // （Unsupported POST-request to query procedure / Unsupported GET-request to mutation procedure）。
        const procedureType = (procedure?._def?.type ?? 'query') as string
        const defaultMethod = procedureType === 'query' ? 'get' : 'post'
        const method = (openApiMeta.method ?? defaultMethod).toLowerCase()

        const inputs = procedure?._def?.inputs ?? []
        const inputParser = inputs.length > 0 ? inputs[inputs.length - 1] : undefined

        let requestBody: Record<string, unknown> | undefined
        let parameters: Record<string, unknown>[] | undefined
        let inputSchemaForDoc: Record<string, unknown> | undefined
        let inputExample: string | undefined

        if (inputParser !== undefined) {
            const converted = toOpenApiSchema(inputParser, { io: 'input' })
            mergeDefs(converted.defs, `${procedurePath} (input)`)

            if (converted.warning) {
                warnings.push(`${procedurePath} (input): ${converted.warning}`)
            }

            inputSchemaForDoc = converted.schema
            inputExample = JSON.stringify(sampleFromSchema(converted.schema))

            if (method === 'get') {
                // OpenAPI 的 GET 没有请求体语义，tRPC 也要求把整个入参序列化成
                // JSON 字符串放进 input 查询参数，所以这里用 parameters 而不是 requestBody。
                parameters = [
                    {
                        name: 'input',
                        in: 'query',
                        required: true,
                        description: 'tRPC 入参：把业务入参序列化成 JSON 字符串（`encodeURIComponent(JSON.stringify(input))`）。完整结构见 `x-trpc-input-schema`。',
                        schema: { type: 'string' },
                        example: inputExample
                    }
                ]
            }
            else {
                // 非批量 POST 的请求体就是入参 JSON 本身（已实测：tRPC 不会读取 json 字段包裹）。
                const bodySchema = converted.schema.description
                    ? converted.schema
                    : { ...converted.schema, description: 'tRPC 调用的请求体：直接发送入参 JSON' }

                requestBody = {
                    required: true,
                    content: {
                        'application/json': {
                            schema: bodySchema
                        }
                    }
                }
            }
        }

        // ---------- 200 响应 ----------
        const inference = openApiMeta.responseSchema
            ? { schema: openApiMeta.responseSchema, source: 'meta' as const, note: undefined }
            : inferResponseSchema(routerName, procedureName)

        const responses: Record<string, unknown> = {}

        if (inference.schema) {
            const converted = toOpenApiSchema(inference.schema, { io: 'output' })
            mergeDefs(converted.defs, `${procedurePath} (response)`)

            if (converted.warning) {
                warnings.push(`${procedurePath} (response): ${converted.warning}`)
            }

            coverage.inferred += 1
            coverage.bySource[inference.source] = (coverage.bySource[inference.source] ?? 0) + 1

            responses[200] = {
                description: `业务数据。tRPC 会把它包在 \`result.data\` 中返回（推断来源：${inference.source}）${
                    inference.source === 'rule' || inference.source === 'special'
                        ? '；结构按 shared 响应契约推断，可能少于实现里的联表字段'
                        : ''
                }。`,
                content: {
                    'application/json': {
                        schema: trpcResultEnvelope(converted.schema)
                    }
                },
                'x-trpc-data-schema': converted.schema
            }
        }
        else {
            coverage.missing.push(inference.note ?? `${procedurePath}: response schema not inferred`)

            responses[200] = {
                description: '业务数据。tRPC 会把它包在 `result.data` 中返回，该接口尚未推断出响应 schema（见 x-openapi-response-coverage.missing）。',
                content: {
                    'application/json': {
                        schema: trpcResultEnvelope({ description: '结构见对应 Service 实现' })
                    }
                }
            }
        }

        responses[400] = trpcErrorResponse('入参校验失败或业务校验失败（AppError），data.i18nKey 为原始错误 key。')
        responses[401] = trpcErrorResponse('未登录（auth.unauthorized）。')
        responses[403] = trpcErrorResponse('已登录但缺少权限码（auth.forbidden）。')
        responses[500] = trpcErrorResponse('未预期的服务端错误。')

        const operation: Record<string, unknown> = {
            tags,
            summary: openApiMeta.summary ?? procedurePath,
            operationId: procedurePath.replace(/\./g, '_'),
            description: openApiMeta.description
                ?? buildProcedureDescription(procedurePath, method, { ...meta, trpcType: procedureType }, inputExample),
            security: meta.auth === 'public' ? [] : [{ cookieAuth: [] }],
            responses
        }

        if (parameters) {
            operation.parameters = parameters
        }

        if (requestBody) {
            operation.requestBody = requestBody
        }

        if (inputSchemaForDoc) {
            operation['x-trpc-input-schema'] = inputSchemaForDoc
        }

        if (typeof meta.permission === 'string' && meta.permission) {
            operation['x-permission'] = meta.permission
        }

        operation['x-trpc-path'] = procedurePath
        operation['x-trpc-type'] = procedureType
        operation['x-response-inferred'] = Boolean(inference.schema)

        const operationPath = openApiMeta.path ?? `${TRPC_ENDPOINT_PREFIX}${procedurePath}`

        paths[operationPath] = {
            ...(paths[operationPath] ?? {}),
            [method]: operation
        }
    }

    coverage.bySource = {
        rule: coverage.bySource.rule ?? 0,
        special: coverage.bySource.special ?? 0,
        meta: coverage.bySource.meta ?? 0
    }

    const document: Record<string, unknown> = {
        openapi: '3.0.3',
        info: {
            title,
            version,
            description
        },
        tags: [
            ...Array.from(tagNames)
                .sort()
                .map(name => name === manualTagName
                    ? manualTag
                    : { name, description: `tRPC 路由命名空间 ${name}` })
        ],
        paths,
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'nuxt-session',
                    description: 'nuxt-auth-utils 的会话 Cookie。在同源页面上调用时浏览器会自动携带，无需手工填写。'
                }
            },
            schemas
        },
        'x-openapi-warnings': warnings,
        'x-openapi-response-coverage': coverage
    }

    if (servers?.length) {
        document.servers = servers
    }

    return { document, warnings, coverage }
}
