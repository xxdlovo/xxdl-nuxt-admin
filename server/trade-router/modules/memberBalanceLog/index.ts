//#server/trade-router/modules/memberBalanceLog
import { router, proc } from '~~/server/trpc/init'
import z from 'zod'
import {
    SysMemberBalanceLogExportSchema,
    SysMemberBalanceLogPageQuerySchema,
    SysMemberBalanceLogQuerySchema,
    SysMemberBalanceLogRechargeRetrySchema,
    SysMemberBalanceLogReconcileSchema,
    SysMemberBalanceLogSummarySchema
} from '#shared/system/memberBalanceLog'
import { SysMemberUserOptionQuerySchema } from '#shared/system/member'
import { sysMemberBalanceLogService } from './SysMemberBalanceLogService'

const listProc = proc({ permission: 'system:memberBalanceLog:list' })
const reconcileProc = proc({ permission: 'system:memberBalanceLog:reconcile' })
// 导出属查询，但需要审计谁导出了什么条件的数据，因此显式开启操作日志
const exportProc = proc({ permission: 'system:memberBalanceLog:export', log: true })

export const sysMemberBalanceLogRouter = router({
    getOne: listProc.input(SysMemberBalanceLogQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberBalanceLogService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysMemberBalanceLogService(ctx).getById(input)
        }),
    page: listProc.input(SysMemberBalanceLogPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberBalanceLogService(ctx).page(input)
        }),
    list: listProc.input(SysMemberBalanceLogQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberBalanceLogService(ctx).list(input)
        }),

    /** 会员下拉搜索（流水按会员筛选），只列已有会员档案的用户 */
    userOptions: listProc.input(SysMemberUserOptionQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberBalanceLogService(ctx).userOptions(input)
        }),

    /** 区间汇总（对账看板） */
    summary: listProc.input(SysMemberBalanceLogSummarySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberBalanceLogService(ctx).summary(input)
        }),

    /** 一致性校验：钱包余额 vs 流水净额 */
    reconcile: reconcileProc.input(SysMemberBalanceLogReconcileSchema)
        .query(async ({ ctx, input }) => {
            return sysMemberBalanceLogService(ctx).reconcile(input)
        }),

    /** 未到账充值补偿（幂等） */
    rechargeRetry: reconcileProc.input(SysMemberBalanceLogRechargeRetrySchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberBalanceLogService(ctx).rechargeRetry(input)
        }),

    /** 导出 CSV：返回 { filename, content }，前端用 Blob 触发下载 */
    export: exportProc.input(SysMemberBalanceLogExportSchema)
        .query(async ({ ctx, input }) => {
            return sysMemberBalanceLogService(ctx).exportCsv(input)
        })
})
