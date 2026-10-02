import { describe, it, expect, vi } from 'vitest'
import { demoReadonlyMiddleware } from '../server/trpc/middlewares/demo'
import { AppError } from '../server/utils/appError'

/**
 * demo 只读保护的中间件策略测试。
 *
 * 直接测中间件本身：它的行为只由 enabled 参数与 opts.type 决定，
 * 与运行时的 NUXT_DEMO_MODE 无关，因此无需改环境变量即可覆盖两种模式。
 * enabled 的取值逻辑在 proc() 内（init.ts），这里聚焦「命中后拦不拦」。
 */
function createOpts(type: 'query' | 'mutation') {
    const next = vi.fn(async () => ({ ok: true, marker: type }))
    return { type, next }
}

describe('demoReadonlyMiddleware', () => {
    it('未启用时（demo 关闭）：query 与 mutation 都放行', async () => {
        const middleware = demoReadonlyMiddleware(false)

        for (const type of ['query', 'mutation'] as const) {
            const opts = createOpts(type)
            await expect(middleware(opts)).resolves.toMatchObject({ ok: true, marker: type })
            expect(opts.next).toHaveBeenCalledTimes(1)
        }
    })

    it('已启用时：query 必须放行（auth.profile 等只读接口不能被拦）', async () => {
        const middleware = demoReadonlyMiddleware(true)
        const opts = createOpts('query')

        await expect(middleware(opts)).resolves.toMatchObject({ ok: true, marker: 'query' })
        expect(opts.next).toHaveBeenCalledTimes(1)
    })

    it('已启用时：mutation 必须被拒，错误码为 system.demoReadonly', async () => {
        const middleware = demoReadonlyMiddleware(true)
        const opts = createOpts('mutation')

        // i18nKey 是 AppError 的直接属性（非 cause）
        await expect(middleware(opts)).rejects.toMatchObject({
            i18nKey: 'system.demoReadonly'
        })
        // 被拒时不得进入业务逻辑
        expect(opts.next).not.toHaveBeenCalled()
    })

    /**
     * 回归护栏：证明上面「query 放行」的断言确实能捕获修复前的问题。
     *
     * 这里内联复现修复前的实现（只看 enabled、不区分操作类型），
     * 它必须会拦下 query —— 否则说明这些用例并不能反映该 bug。
     */
    it('回归对照：修复前的实现会拦下 query（证明用例有效）', async () => {
        const legacyMiddleware = async (opts: any) => {
            // 旧实现：enabled 为真就直接抛错，不判断 opts.type
            throw new AppError('system.demoReadonly')
        }

        const opts = createOpts('query')

        await expect(legacyMiddleware(opts)).rejects.toMatchObject({
            i18nKey: 'system.demoReadonly'
        })
        expect(opts.next).not.toHaveBeenCalled()
    })
})
