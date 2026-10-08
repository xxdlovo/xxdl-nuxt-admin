//#server/show-case-router
import z from 'zod'
import { protectedProcedure, router } from '~~/server/trpc/init'
import { showCaseService } from './ShowCaseService'

/**
 * 错误演示模块：配合 `app/pages/show-case/error-demo.vue` 演示
 * `errorFormatter` 的三条错误分流。
 *
 * 全部使用 `protectedProcedure`（仅需登录、不校验权限码），
 * 因此不依赖 `sys_menu` 里的菜单与按钮权限数据。
 */
export const showCaseRouter = router({
    /** 对照组：正常返回 */
    ok: protectedProcedure
        .query(({ ctx }) => showCaseService(ctx).ok()),

    /**
     * 入参错误：schema 校验失败时 tRPC 直接抛出 ZodError，
     * `errorFormatter` 汇总 issues 里的字段消息（去重后用「，」连接）。
     */
    validationError: protectedProcedure
        .input(z.object({
            count: z.number().int().min(1, 'form.countRange').max(10, 'form.countRange'),
            keyword: z.string().min(2, 'form.keywordTooShort')
        }))
        .query(({ ctx, input }) => showCaseService(ctx).validationPassed(input)),

    /** 数据库错误：查询不存在的表，触发 MySQL 1146 */
    databaseError: protectedProcedure
        .query(({ ctx }) => showCaseService(ctx).databaseError()),

    /** 业务错误：抛 AppError('common.notExist')，映射为 404 */
    businessError: protectedProcedure
        .query(({ ctx }) => showCaseService(ctx).businessError())
})
