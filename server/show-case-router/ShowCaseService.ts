import { sql } from 'drizzle-orm'
import { useLogger } from 'evlog'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'

/**
 * 错误演示模块的 Service。
 *
 * 只用于演示 `errorFormatter` 的三条分流（校验错误 / 数据库错误 / 业务错误），
 * 不依赖任何业务表，因此**不需要建表、不需要 SQL 迁移、不需要权限码**。
 */
export function showCaseService(ctx: Context) {
    // evlog 宽事件：只记动作与标识，不打印完整入参出参
    const log = useLogger(ctx.event, 'server/show-case-router')

    return {
        /** 对照组：正常返回，用来确认链路本身是通的 */
        async ok() {
            log.info('showCase ok', { showCase: { action: 'ok' } })

            return {
                time: new Date().toISOString(),
                user: ctx.user?.username ?? null
            }
        },

        /**
         * 入参错误的对照组：入参合法时才会执行到这里。
         *
         * 入参非法时 tRPC 在进入 resolver 之前就抛出 ZodError，
         * 本方法不会被执行，日志里也就没有这一条。
         */
        async validationPassed(input: { count: number, keyword: string }) {
            log.info('showCase validation passed', {
                showCase: { action: 'validationError', count: input.count }
            })

            return { count: input.count, keyword: input.keyword }
        },

        /**
         * 数据库错误：故意查询一张不存在的表。
         *
         * MySQL 返回 1146（Table doesn't exist），Drizzle 会把驱动错误挂在 cause 上，
         * `errorFormatter` 通过 `cause.cause.code / sql` 识别为数据库错误。
         * 注意：不需要真的建这张表，报错本身就是演示内容。
         */
        async databaseError() {
            log.info('showCase database error triggered', {
                showCase: { action: 'databaseError', table: 'sys_show_case_not_exist_table' }
            })

            await ctx.db.execute(sql`select * from sys_show_case_not_exist_table limit 1`)

            // 表真的存在时才会走到这里（正常情况下不会）
            return { unreachable: true }
        },

        /**
         * 业务错误：抛 AppError。
         *
         * `common.notExist` 在 `APP_ERROR_STATUS_MAP` 里映射为 404 / NOT_FOUND，
         * 文案由 `errorFormatter` 按请求语言翻译。
         */
        async businessError() {
            log.info('showCase business error triggered', {
                showCase: { action: 'businessError', i18nKey: 'common.notExist' }
            })

            throw new AppError('common.notExist')
        }
    }
}
