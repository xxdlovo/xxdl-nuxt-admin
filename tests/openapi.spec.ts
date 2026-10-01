// OpenAPI 文档生成器测试
//
// 目标：锁定「168 个 procedure 的请求入参 + 200 响应体自动推断 + HTTP 方法映射」这个契约，
// 避免规则表、meta 或 shared 响应 schema 变动后文档静默退化。
//
// 该测试不启动 Nuxt、不访问数据库，只做纯静态的文档生成与断言。
import { describe, it, expect } from 'vitest'
import { buildOpenApiDocument } from '../server/openapi/buildDocument'

type AnyRecord = Record<string, any>

const { document, coverage, warnings } = buildOpenApiDocument({
    servers: [{ url: 'http://localhost:3001' }]
})

const paths = document.paths as AnyRecord
const components = document.components as AnyRecord

/** 取某个 tRPC 接口的 operation。 */
function trpcOperation(procedurePath: string, method: 'get' | 'post'): AnyRecord {
    const item = paths[`/api/trpc/${procedurePath}`]
    expect(item, `缺少路径 /api/trpc/${procedurePath}`).toBeTruthy()

    const operation = item[method]
    expect(operation, `缺少 ${method.toUpperCase()} /api/trpc/${procedurePath}`).toBeTruthy()

    return operation as AnyRecord
}

/** 取 200 响应里的业务数据结构（tRPC 的 result.data）。 */
function responseDataSchema(operation: AnyRecord): AnyRecord {
    const response = operation.responses['200'] as AnyRecord
    expect(response).toBeTruthy()
    return response.content['application/json'].schema.properties.result.properties.data as AnyRecord
}

/** 展开文档里所有 operation，便于做全局约束断言。 */
function collectOperations() {
    return Object.entries(paths).flatMap(([path, item]) =>
        Object.entries(item as AnyRecord)
            .filter(([method]) => ['get', 'post', 'put', 'delete', 'patch'].includes(method))
            .map(([method, operation]) => ({ path, method, operation: operation as AnyRecord }))
    )
}

describe('OpenAPI 文档结构', () => {
    it('输出 OpenAPI 3.0.3 与基础信息', () => {
        expect(document.openapi).toBe('3.0.3')
        expect((document.info as AnyRecord).title).toBeTruthy()
        expect((document.info as AnyRecord).version).toBeTruthy()
        expect(components.securitySchemes.cookieAuth).toMatchObject({
            type: 'apiKey',
            in: 'cookie',
            name: 'nuxt-session'
        })
    })

    it('覆盖全部 tRPC procedure 与原生路由', () => {
        expect(coverage.total).toBeGreaterThanOrEqual(160)
        expect(paths['/api/system/oss/upload'].post).toBeTruthy()
        expect(paths['/api/system/user/avatar'].post).toBeTruthy()
        expect(paths['/auth/{platform}'].get).toBeTruthy()
    })

    it('生成过程没有 schema 转换失败或命名冲突', () => {
        expect(Array.isArray(warnings)).toBe(true)
        expect(warnings).toEqual([])
        expect(document['x-openapi-warnings']).toEqual([])
    })

    it('不残留 OpenAPI 3.0 不认识的 $defs 引用', () => {
        // Zod 抽取出的 $defs 必须已经被提升到 components.schemas
        expect(JSON.stringify(document).includes('$defs')).toBe(false)
        expect(JSON.stringify(document).includes('#/$defs/')).toBe(false)
    })

    it('每个 operation 都具备 OpenAPI 必需字段，且 operationId 唯一', () => {
        const operations = collectOperations()

        expect(operations.length).toBeGreaterThan(160)

        const operationIds = new Set<string>()

        for (const { path, method, operation } of operations) {
            const where = `${method.toUpperCase()} ${path}`

            expect(operation.tags, `${where} tags`).toBeTruthy()
            expect(operation.summary, `${where} summary`).toBeTruthy()
            expect(operation.description, `${where} description`).toBeTruthy()
            // OAuth 回调是重定向端点，成功响应是 302 而不是 200
            const successResponse = operation.responses?.['200'] ?? operation.responses?.['302']
            expect(successResponse, `${where} 缺少成功响应`).toBeTruthy()
            expect(operation.operationId, `${where} operationId`).toBeTruthy()
            expect(operationIds.has(operation.operationId), `${where} 重复 operationId`).toBe(false)

            operationIds.add(operation.operationId)
        }
    })

    it('query 一律用 GET、mutation 一律用 POST', () => {
        // tRPC 会拒绝错配的方法：405 Unsupported POST-request to query procedure
        const trpcOperations = collectOperations().filter(item => item.path.startsWith('/api/trpc/'))

        expect(trpcOperations.length).toBeGreaterThan(160)

        for (const { path, method, operation } of trpcOperations) {
            const expected = operation['x-trpc-type'] === 'query' ? 'get' : 'post'
            expect(method, `${path} 的 HTTP 方法`).toBe(expected)
        }

        // 抽查：query 只有 GET，mutation 只有 POST
        expect(paths['/api/trpc/sysUser.page'].get).toBeTruthy()
        expect(paths['/api/trpc/sysUser.page'].post).toBeUndefined()
        expect(paths['/api/trpc/demo.getById'].get).toBeTruthy()
        expect(paths['/api/trpc/demo.getById'].post).toBeUndefined()
        expect(paths['/api/trpc/sysUser.create'].post).toBeTruthy()
        expect(paths['/api/trpc/sysUser.create'].get).toBeUndefined()
    })
})

describe('入参表达', () => {
    it('query 的入参走 input 查询参数，并保留真实 schema', () => {
        const operation = trpcOperation('sysUser.page', 'get')

        // GET 没有请求体语义
        expect(operation.requestBody).toBeUndefined()

        const input = operation.parameters.find((item: AnyRecord) => item.name === 'input')
        expect(input).toMatchObject({ in: 'query', required: true })
        expect(input.schema.type).toBe('string')

        // 参数本身是 JSON 字符串，真实结构放在扩展里
        const schema = operation['x-trpc-input-schema']
        expect(Object.keys(schema.properties)).toEqual(expect.arrayContaining(['page', 'pageSize']))
    })

    it('query 的 input 参数给出可直接使用的 JSON 示例', () => {
        const operation = trpcOperation('sysUser.page', 'get')
        const input = operation.parameters.find((item: AnyRecord) => item.name === 'input')

        const parsed = JSON.parse(input.example)
        expect(parsed).toHaveProperty('page')
        expect(parsed).toHaveProperty('pageSize')
        expect(operation.description).toContain('input=')
    })

    it('mutation 的请求体就是入参 JSON 本身', () => {
        const operation = trpcOperation('auth.login', 'post')
        const jsonSchema = operation.requestBody.content['application/json'].schema

        expect(jsonSchema.required).toEqual(['username', 'password'])

        const pageCreate = trpcOperation('sysUser.create', 'post')
        expect(Object.keys(pageCreate.requestBody.content['application/json'].schema.properties))
            .toEqual(expect.arrayContaining(['id', 'username', 'password']))
    })

    it('无入参的 mutation 不生成 requestBody 或 parameters', () => {
        const operation = trpcOperation('auth.logout', 'post')

        expect(operation.requestBody).toBeUndefined()
        expect(operation.parameters).toBeUndefined()
    })
})

describe('200 响应体 schema（按约定推断）', () => {
    it('page 返回 tRPC 分页结构，且列表项来自 shared 响应契约', () => {
        const data = responseDataSchema(trpcOperation('sysUser.page', 'get'))

        expect(data.type).toBe('object')
        expect(data.required).toEqual(expect.arrayContaining(['list', 'total', 'page', 'pageSize']))
        expect(data.properties.list.type).toBe('array')
        expect(data.properties.list.items.properties.username).toBeTruthy()
        expect(data.properties.total.type).toBe('integer')
    })

    it('getById 返回单个实体', () => {
        const data = responseDataSchema(trpcOperation('demo.getById', 'get'))

        expect(data.properties.id).toBeTruthy()
        expect(data.properties.field1).toBeTruthy()
    })

    it('响应契约里不包含敏感字段', () => {
        const data = responseDataSchema(trpcOperation('sysUser.page', 'get'))

        expect(JSON.stringify(data.properties.list.items)).not.toContain('password')
    })

    it('写操作返回 boolean，批量删除返回 number', () => {
        expect(responseDataSchema(trpcOperation('sysUser.create', 'post')).type).toBe('boolean')
        expect(responseDataSchema(trpcOperation('sysUser.update', 'post')).type).toBe('boolean')
        expect(responseDataSchema(trpcOperation('sysUser.batchDelete', 'post')).type).toBe('number')
    })

    it('非标准方法由 specialResponses 覆盖', () => {
        const getValueByKey = responseDataSchema(trpcOperation('sysConfig.getValueByKey', 'get'))
        expect(getValueByKey.type).toBe('string')
        expect(getValueByKey.nullable).toBe(true)

        const assignedRoleIds = responseDataSchema(trpcOperation('sysUser.assignedRoleIds', 'get'))
        expect(assignedRoleIds.type).toBe('array')
        expect(assignedRoleIds.items.type).toBe('string')

        const verify = responseDataSchema(trpcOperation('sysOssConfig.verify', 'post'))
        expect(verify.required).toEqual(expect.arrayContaining(['success', 'message']))
    })

    it('session 相关接口用 AuthUser 镜像结构', () => {
        const login = responseDataSchema(trpcOperation('auth.login', 'post'))
        expect(login.required).toEqual(expect.arrayContaining(['id', 'username']))

        const myProfile = responseDataSchema(trpcOperation('auth.myProfile', 'get'))
        expect(myProfile.properties.hasPassword.type).toBe('boolean')
    })

    it('响应覆盖率达标，未覆盖清单只含已知缺口', () => {
        expect(coverage.inferred / coverage.total).toBeGreaterThanOrEqual(0.94)
        expect(coverage.bySource.rule).toBeGreaterThan(0)
        expect(coverage.bySource.special).toBeGreaterThan(0)
        expect(coverage.missing.length).toBeLessThanOrEqual(4)

        for (const item of coverage.missing) {
            expect(item).toMatch(/^(auth\.profile|sysJob\.runNow|sysStorage\.)/)
        }
    })
})

describe('安全声明与权限码', () => {
    it('需要权限的接口标注 permission 与 cookie 鉴权', () => {
        const operation = trpcOperation('sysUser.page', 'get')

        expect(operation.security).toEqual([{ cookieAuth: [] }])
        expect(operation['x-permission']).toBe('system:user:list')
        expect(operation.description).toContain('system:user:list')
    })

    it('公开接口的 security 为空数组', () => {
        expect(trpcOperation('auth.login', 'post').security).toEqual([])
        expect(trpcOperation('auth.register', 'post').security).toEqual([])
        expect(trpcOperation('auth.me', 'get').security).toEqual([])
    })

    it('每个接口都有统一的错误响应声明', () => {
        const operation = trpcOperation('sysUser.page', 'get')

        for (const status of ['400', '401', '403', '500']) {
            expect(operation.responses[status]).toBeTruthy()
            expect(operation.responses[status].content['application/json'].schema.properties.error).toBeTruthy()
        }
    })
})
