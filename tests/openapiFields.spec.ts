// API 文档页「字段多选」入参构造的测试
//
// 需求核心：把 OpenAPI 的 parameters 解析成可勾选字段，并**按 zod 模式默认勾选必填项**。
// 这里同时覆盖纯函数规则和真实文档（zod → JSON Schema → 前端初值）的端到端结果。
import { describe, it, expect } from 'vitest'
import { buildOpenApiDocument } from '../server/openapi/buildDocument'
import {
    allFieldsValue,
    initialFieldValue,
    initialValueFromSchema,
    isFieldObjectSchema,
    parseEndpoints
} from '../app/pages/system/openapi/useOpenapiFields'

const { document } = buildOpenApiDocument()
const { endpoints, groups } = parseEndpoints(document as Record<string, any>)

function endpointById(id: string) {
    const found = endpoints.find(item => item.id === id)
    expect(found, `文档里缺少 operationId=${id}`).toBeTruthy()
    return found!
}

describe('initialFieldValue：字段初值取材', () => {
    it('优先使用 default，其次 example，再次 enum 首项', () => {
        expect(initialFieldValue({ type: 'integer', default: 10 })).toBe(10)
        expect(initialFieldValue({ type: 'string', example: 'sample' })).toBe('sample')
        expect(initialFieldValue({ type: 'string', enum: ['b', 'a'] })).toBe('b')
    })

    it('default 为对象时做深拷贝，避免共享引用', () => {
        const schema = { type: 'object', default: { page: 1 } }
        const first = initialFieldValue(schema) as Record<string, unknown>
        const second = initialFieldValue(schema) as Record<string, unknown>

        expect(first).toEqual({ page: 1 })
        expect(first).not.toBe(second)
    })

    it('没有 default/example/enum 时按类型给空值', () => {
        expect(initialFieldValue({ type: 'string' })).toBe('')
        expect(initialFieldValue({ type: 'integer' })).toBe(0)
        expect(initialFieldValue({ type: 'number' })).toBe(0)
        expect(initialFieldValue({ type: 'boolean' })).toBe(false)
        expect(initialFieldValue({ type: 'array', items: { type: 'string' } })).toEqual([])
        // z.unknown() 生成的空 schema
        expect(initialFieldValue({})).toBeNull()
    })
})

describe('initialValueFromSchema：默认勾选规则', () => {
    it('必填字段默认勾选', () => {
        const value = initialValueFromSchema({
            type: 'object',
            properties: {
                id: { type: 'string' },
                name: { type: 'string' }
            },
            required: ['id']
        })

        expect(value).toEqual({ id: '' })
        expect(Object.keys(value)).not.toContain('name')
    })

    it('带 default 的字段默认勾选，并直接带上默认值', () => {
        const value = initialValueFromSchema({
            type: 'object',
            properties: {
                page: { type: 'integer', default: 1 },
                pageSize: { type: 'integer', default: 10 },
                keyword: { type: 'string' }
            },
            required: []
        })

        expect(value).toEqual({ page: 1, pageSize: 10 })
    })

    it('可选且无默认值的字段默认不勾选', () => {
        const value = initialValueFromSchema({
            type: 'object',
            properties: {
                nickname: { type: 'string', nullable: true },
                deptId: { type: 'string', nullable: true }
            }
        })

        expect(value).toEqual({})
    })

    it('必填的嵌套对象只带上它自己的必填子字段', () => {
        const value = initialValueFromSchema({
            type: 'object',
            properties: {
                filter: {
                    type: 'object',
                    properties: {
                        keyword: { type: 'string' },
                        optional: { type: 'string' }
                    },
                    required: ['keyword']
                }
            },
            required: ['filter']
        })

        expect(value).toEqual({ filter: { keyword: '' } })
    })

    it('非对象 schema 不产生字段', () => {
        expect(initialValueFromSchema({ type: 'string' })).toEqual({})
        expect(initialValueFromSchema({ type: 'array', items: { type: 'string' } })).toEqual({})
        expect(initialValueFromSchema(undefined)).toEqual({})
    })
})

describe('allFieldsValue / isFieldObjectSchema', () => {
    it('全选会带入所有字段', () => {
        const schema = {
            type: 'object',
            properties: {
                a: { type: 'string' },
                b: { type: 'integer' },
                c: { type: 'boolean' }
            }
        }

        expect(allFieldsValue(schema)).toEqual({ a: '', b: 0, c: false })
    })

    it('只有带 properties 的 object 才渲染成字段表单', () => {
        expect(isFieldObjectSchema({ type: 'object', properties: { a: { type: 'string' } } })).toBe(true)
        expect(isFieldObjectSchema({ type: 'object' })).toBe(false)
        expect(isFieldObjectSchema({ type: 'string' })).toBe(false)
        expect(isFieldObjectSchema(undefined)).toBe(false)
    })
})

describe('真实文档：zod 必填项被默认勾选', () => {
    it('查询接口默认带入 page / pageSize（.default() 字段）', () => {
        const page = endpointById('sysUser_page')
        const value = initialValueFromSchema(page.inputSchema)

        expect(Object.keys(value)).toEqual(expect.arrayContaining(['page', 'pageSize']))
        expect(value.page).toBe(1)
        expect(value.pageSize).toBe(10)
        // 查询条件字段都是 nullish，默认不勾选
        expect(Object.keys(value)).not.toContain('username')
    })

    it('新增接口默认带入全部必填字段，可选字段不勾选', () => {
        const create = endpointById('sysUser_create')
        const value = initialValueFromSchema(create.inputSchema)

        expect(Object.keys(value)).toEqual(expect.arrayContaining(['id', 'username', 'email', 'password']))
        expect(Object.keys(value)).not.toContain('nickname')
        expect(Object.keys(value)).not.toContain('remark')
    })

    it('query 端点标记为 GET 并带 input schema，mutation 端点标记为 POST', () => {
        const page = endpointById('sysUser_page')
        const create = endpointById('sysUser_create')

        expect(page.method).toBe('get')
        expect(create.method).toBe('post')
        expect(page.hasInput).toBe(true)
        expect(create.hasInput).toBe(true)
    })

    it('无入参的接口不会被误判为需要字段', () => {
        const logout = endpointById('auth_logout')

        expect(logout.hasInput).toBe(false)
        expect(initialValueFromSchema(logout.inputSchema)).toEqual({})
    })
})

describe('parseEndpoints：文档解析', () => {
    it('覆盖全部端点并按 tag 分组', () => {
        expect(endpoints.length).toBeGreaterThan(160)
        expect(groups.length).toBeGreaterThan(10)

        const sysUserGroup = groups.find(group => group.tag === 'sysUser')
        expect(sysUserGroup).toBeTruthy()
        expect(sysUserGroup!.endpoints.every(item => item.path.startsWith('/api/trpc/sysUser.'))).toBe(true)
    })

    it('保留权限码与 tRPC 路径映射', () => {
        const page = endpointById('sysUser_page')

        expect(page.permission).toBe('system:user:list')
        expect(page.trpcPath).toBe('sysUser.page')
        expect(page.trpcType).toBe('query')
        expect(page.path).toBe('/api/trpc/sysUser.page')
    })

    it('解析原生路由（无 tRPC 扩展字段）', () => {
        const upload = endpoints.find(item => item.path === '/api/system/oss/upload')

        expect(upload).toBeTruthy()
        expect(upload!.method).toBe('post')
        expect(upload!.trpcPath).toBeUndefined()
        expect(upload!.permission).toBe('system:oss:add')
    })
})
