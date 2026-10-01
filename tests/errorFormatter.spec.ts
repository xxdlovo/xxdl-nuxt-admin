// errorFormatter 行为测试
//
// 锁定三条容易被改坏的规则：
// 1. 业务错误（AppError）必须映射到 4xx，前端与监控据此区分「请求有问题」和「服务端异常」；
// 2. 响应体默认不带堆栈，只有 NUXT_TRPC_ERROR_STACK=true 才返回；
// 3. type 是「错误分类」（前端 toast 标题），不能与 message（描述）重复。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { errorFormatter } from '../server/trpc/errorFormatter'
import { AppError } from '../server/utils/appError'

type AnyRecord = Record<string, any>

/** 模拟 tRPC 调用链：业务代码抛出的 cause 会被包进 TRPCError。 */
function formatError(cause: unknown, options: { trpcCode?: AnyRecord; locale?: string } = {}) {
    const shape = {
        message: 'wrapped',
        code: -32603,
        data: {
            code: options.trpcCode ?? 'INTERNAL_SERVER_ERROR',
            httpStatus: 500,
            path: 'sysConfig.getOne'
        }
    }

    const ctx = options.locale
        ? { event: { node: { req: { headers: { 'x-locale': options.locale } }, res: {} } } }
        : undefined

    const error = new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'wrapped' })

    // 直接赋值而不是走构造函数：tRPC 的 TRPCError 会对 cause 做规范化，
    // 而 zod 4 的 ZodError 不是同一个 Error 类的实例，会被包装成 UnknownCauseError
    // 并丢掉 issues —— 真实链路（input 校验失败）里 cause 是裸 ZodError，这里要贴近它。
    ;(error as AnyRecord).cause = cause

    const formatted = errorFormatter({ error, shape, ctx })

    return formatted as { message: string; data: AnyRecord }
}

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('AppError 的状态码映射', () => {
    it('未登录 → 401 UNAUTHORIZED', () => {
        const { data } = formatError(new AppError('auth.unauthorized'))

        expect(data.code).toBe('UNAUTHORIZED')
        expect(data.httpStatus).toBe(401)
        expect(data.i18nKey).toBe('auth.unauthorized')
    })

    it('无权限 → 403 FORBIDDEN', () => {
        const { data } = formatError(new AppError('auth.forbidden'))

        expect(data.code).toBe('FORBIDDEN')
        expect(data.httpStatus).toBe(403)
    })

    it('demo 只读保护 → 403 FORBIDDEN', () => {
        const { data } = formatError(new AppError('system.demoReadonly'))

        expect(data.code).toBe('FORBIDDEN')
        expect(data.httpStatus).toBe(403)
    })

    it('查询不存在 → 404 NOT_FOUND', () => {
        const { data } = formatError(new AppError('common.notExist'))

        expect(data.code).toBe('NOT_FOUND')
        expect(data.httpStatus).toBe(404)
        expect(data.i18nKey).toBe('common.notExist')
    })

    it('其余业务错误 → 400 BAD_REQUEST，不再是 500', () => {
        const { data } = formatError(new AppError('module.system.oss.uploadFileRequired'))

        expect(data.code).toBe('BAD_REQUEST')
        expect(data.httpStatus).toBe(400)
    })

    it('未知 i18n key 回退到分类文案，不把裸 key 返回给用户', () => {
        const { data } = formatError(new AppError('module.not.exists.key'))

        expect(data.i18nKey).toBe('module.not.exists.key')
        expect(data.message).not.toBe('module.not.exists.key')
        expect(data.message).not.toContain('.')
    })
})

describe('type 是错误分类（前端 toast 标题）', () => {
    it('业务错误的 type 与 message 不同，避免 toast 标题与描述重复', () => {
        const { message, data } = formatError(new AppError('common.notExist'), { locale: 'zh' })

        expect(data.type).toBe('业务错误')
        expect(message).toBe('查询数据不存在')
        expect(data.type).not.toBe(message)
    })

    it('校验错误 / 服务端错误的分类文案正确', () => {
        const zodResult = formatError(new z.ZodError([]), { locale: 'zh', trpcCode: 'BAD_REQUEST' })
        expect(zodResult.data.type).toBe('校验错误')

        const serverResult = formatError(new Error('boom'), { locale: 'zh' })
        expect(serverResult.data.type).toBe('服务端错误')
    })

    it('Zod 校验错误聚合字段消息并用中文逗号连接', () => {
        const zodError = new z.ZodError([
            { code: 'custom', path: ['username'], message: 'form.userName.required' },
            { code: 'custom', path: ['password'], message: 'form.pwd.required' }
        ])

        const { message } = formatError(zodError, { locale: 'zh', trpcCode: 'BAD_REQUEST' })

        expect(message).toContain('，')
        expect(message).not.toContain('form.')
    })

    it('拿不到 issues 的 Zod 错误回退到通用文案，绝不暴露原始 JSON', () => {
        // 模拟 cause 被包装成只保留 name / message 的形态
        const wrapped = {
            name: 'ZodError',
            message: '[{"code":"custom","path":["a"],"message":"x"}]'
        }

        const { message, data } = formatError(wrapped, { locale: 'zh' })

        expect(data.type).toBe('校验错误')
        expect(message).not.toContain('code')
        expect(message).not.toContain('{')
        expect(message).toBe('请检查输入的值是否合法')
    })

    it('重复的校验消息只保留一条', () => {
        const zodError = new z.ZodError([
            { code: 'custom', path: ['a'], message: 'form.required' },
            { code: 'custom', path: ['b'], message: 'form.required' }
        ])

        const { message } = formatError(zodError, { locale: 'zh', trpcCode: 'BAD_REQUEST' })

        expect(message.split('，')).toHaveLength(1)
    })
})

describe('堆栈与内部信息', () => {
    it('默认不返回堆栈', () => {
        const { data } = formatError(new AppError('common.notExist'))

        expect(data.stack).toBeUndefined()
    })

    it('NUXT_TRPC_ERROR_STACK=true 时才返回堆栈', () => {
        vi.stubEnv('NUXT_TRPC_ERROR_STACK', 'true')
        const { data } = formatError(new AppError('common.notExist'))

        expect(typeof data.stack).toBe('string')
    })

    it('非生产环境返回程序异常原文，生产环境替换为分类文案', () => {
        vi.stubEnv('NODE_ENV', 'development')
        expect(formatError(new Error('boom')).data.message).toBe('boom')

        vi.stubEnv('NODE_ENV', 'production')
        expect(formatError(new Error('boom')).data.message).not.toBe('boom')
    })

    it('数据库异常的原始 SQL 信息不在生产环境外泄', () => {
        // Drizzle 把驱动错误包在 cause 上，mysql2 的字段是 sqlMessage / sql
        const dbError = new Error('Failed query: select * from sys_user')
        ;(dbError as AnyRecord).cause = {
            sqlMessage: "Unknown column 'secret_column' in 'field list'",
            sql: 'select * from sys_user',
            code: 'ER_BAD_FIELD_ERROR'
        }

        vi.stubEnv('NODE_ENV', 'production')
        const prodMessage = formatError(dbError).data.message
        expect(prodMessage).not.toContain('select * from sys_user')
        expect(prodMessage).not.toContain('Unknown column')

        vi.stubEnv('NODE_ENV', 'development')
        const devMessage = formatError(dbError).data.message
        expect(devMessage).toContain('Unknown column')
        expect(devMessage).toContain('select * from sys_user')
    })
})

describe('响应其它字段', () => {
    it('保留 tRPC 的 path 并补充 timestamp', () => {
        const { data } = formatError(new AppError('common.notExist'))

        expect(data.path).toBe('sysConfig.getOne')
        expect(new Date(data.timestamp).toString()).not.toBe('Invalid Date')
    })

    it('顶层 message 与 data.message 保持一致', () => {
        const { message, data } = formatError(new AppError('common.notExist'), { locale: 'zh' })

        expect(message).toBe(data.message)
    })
})
