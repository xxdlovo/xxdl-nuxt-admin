import { z } from 'zod'

/**
 * 把项目里的 Zod Schema（tRPC 的 .input() / 响应契约）转成 OpenAPI 3.0 兼容的 JSON Schema。
 *
 * 选择 OpenAPI 3.0 而不是 3.1 的原因：Zod 的 `openapi-3.0` target 会输出
 * `nullable: true` 这种 3.0 方言，与项目的空值约定（大量 `.nullish()`）语义一致。
 */

export type OpenApiSchema = Record<string, unknown>

export type SchemaConversionResult = {
    /** 可直接放进 OpenAPI 文档的 JSON Schema */
    schema: OpenApiSchema
    /**
     * Zod 抽取出来的共享定义（`$defs`）。
     * OpenAPI 3.0 不认 `#/$defs/...` 引用，调用方需要把它们合并进
     * `components.schemas`，schema 内部的 `$ref` 已被重写为对应前缀。
     */
    defs: Record<string, OpenApiSchema>
    /** 转换失败时的原因，供 x-openapi-warnings 汇报，不影响文档整体生成 */
    warning?: string
}

const REF_PREFIX = '#/$defs/'
const COMPONENT_REF_PREFIX = '#/components/schemas/'

type JsonRecord = Record<string, unknown>

/**
 * 判定一个 tRPC input parser 是否是 Zod Schema。
 *
 * tRPC v11 允许任意 Standard Schema，项目内实际全部是 Zod。
 * Zod 4 实例带 `_zod`，Zod 3 实例带 `_def`，两者都保留 `parseAsync`。
 */
export function isZodSchema(value: unknown): value is z.ZodType {
    if (!value || typeof value !== 'object') {
        return false
    }

    const candidate = value as Record<string, unknown>
    const looksLikeZod = '_zod' in candidate || '_def' in candidate

    return looksLikeZod && typeof candidate.parseAsync === 'function'
}

/** 递归重写 `#/$defs/x` 引用为 `#/components/schemas/x`。 */
function rewriteDefsRefs(node: unknown): unknown {
    if (Array.isArray(node)) {
        return node.map(rewriteDefsRefs)
    }

    if (node && typeof node === 'object') {
        const source = node as JsonRecord
        const target: JsonRecord = {}

        for (const [key, value] of Object.entries(source)) {
            if (key === '$ref' && typeof value === 'string' && value.startsWith(REF_PREFIX)) {
                target[key] = `${COMPONENT_REF_PREFIX}${value.slice(REF_PREFIX.length)}`
                continue
            }

            target[key] = rewriteDefsRefs(value)
        }

        return target
    }

    return node
}

export type ToOpenApiSchemaOptions = {
    /**
     * 请求体用 `input`（保留 `.default()` 等输入侧语义），
     * 响应体用 `output`。
     */
    io?: 'input' | 'output'
}

export function toOpenApiSchema(
    input: unknown,
    options: ToOpenApiSchemaOptions = {}
): SchemaConversionResult {
    const { io = 'input' } = options

    if (!isZodSchema(input)) {
        return {
            schema: {},
            defs: {},
            warning: 'Input parser is not a Zod schema, schema not generated'
        }
    }

    try {
        const raw = z.toJSONSchema(input, {
            target: 'openapi-3.0',
            io,
            // z.unknown() / z.any() / z.custom() 之类没有 JSON Schema 等价物的类型
            // 退化成 {}（任意值），避免单个 schema 让整份文档生成失败。
            unrepresentable: 'any',
            reused: 'inline',
            cycles: 'ref'
        }) as JsonRecord

        // 使用重建而不是 delete：z.toJSONSchema 的返回值上 `~standard` 是不可配置属性，
        // 严格模式下 delete 会抛 TypeError。
        // 同时清掉 JSON Schema 自身的标识与 Standard Schema 附加字段，
        // 它们既不是 OpenAPI 关键字，也会让工具链报警告。
        const defs: Record<string, OpenApiSchema> = (raw.$defs as Record<string, OpenApiSchema>) ?? {}
        const schema: JsonRecord = {}

        for (const [key, value] of Object.entries(raw)) {
            if (key === '$defs' || key === '$schema' || key === '~standard') {
                continue
            }

            schema[key] = value
        }

        return {
            schema: rewriteDefsRefs(schema) as OpenApiSchema,
            defs: rewriteDefsRefs(defs) as Record<string, OpenApiSchema>
        }
    } catch (error) {
        return {
            schema: {},
            defs: {},
            warning: error instanceof Error ? error.message : String(error)
        }
    }
}

/** `zodToOpenApi` 的常用别名，便于在生成器里链式书写。 */
export const zodToOpenApi = toOpenApiSchema
