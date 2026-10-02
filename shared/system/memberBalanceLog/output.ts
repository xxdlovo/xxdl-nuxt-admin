import { z } from 'zod'
import { SysMemberBalanceLogBaseSchema } from './common'

/** 余额流水响应：列表与详情共用；金额保持 decimal 字符串形态 */
export const SysMemberBalanceLogRespSchema = z.object({
    id: SysMemberBalanceLogBaseSchema.shape.id,
    userId: SysMemberBalanceLogBaseSchema.shape.userId,
    account: SysMemberBalanceLogBaseSchema.shape.account,
    direction: SysMemberBalanceLogBaseSchema.shape.direction,
    amount: SysMemberBalanceLogBaseSchema.shape.amount,
    balanceBefore: SysMemberBalanceLogBaseSchema.shape.balanceBefore,
    balanceAfter: SysMemberBalanceLogBaseSchema.shape.balanceAfter,
    bizType: SysMemberBalanceLogBaseSchema.shape.bizType,
    bizNo: SysMemberBalanceLogBaseSchema.shape.bizNo,
    dedupKey: SysMemberBalanceLogBaseSchema.shape.dedupKey,
    operatorId: SysMemberBalanceLogBaseSchema.shape.operatorId,
    reason: SysMemberBalanceLogBaseSchema.shape.reason,
    remark: SysMemberBalanceLogBaseSchema.shape.remark,
    createdAt: SysMemberBalanceLogBaseSchema.shape.createdAt,
    updatedAt: SysMemberBalanceLogBaseSchema.shape.updatedAt,
})
export type SysMemberBalanceLogRespDTO = z.infer<typeof SysMemberBalanceLogRespSchema>

/**
 * 汇总响应：金额统一为 decimal 字符串（Service 侧聚合后 toFixed(2)）。
 * walletTotal 是钱包当前余额合计，ledgerTotal 是流水累计余额合计，
 * 两者不等即存在记账缺口，用 mismatchCount 提示差异条数。
 */
export const SysMemberBalanceLogSummaryRespSchema = z.object({
    rechargeIn: z.string().nullish(),
    giftIn: z.string().nullish(),
    consumeOut: z.string().nullish(),
    adjustIn: z.string().nullish(),
    adjustOut: z.string().nullish(),
    walletTotal: z.string().nullish(),
    ledgerTotal: z.string().nullish(),
    mismatchCount: z.number().nullish(),
})
export type SysMemberBalanceLogSummaryRespDTO = z.infer<typeof SysMemberBalanceLogSummaryRespSchema>

/** 单个对账差异项：钱包余额与流水累计余额的差额 */
export const SysMemberBalanceLogMismatchSchema = z.object({
    userId: z.string().nullish(),
    walletTotal: z.string().nullish(),
    ledgerTotal: z.string().nullish(),
    diff: z.string().nullish(),
})
export type SysMemberBalanceLogMismatchDTO = z.infer<typeof SysMemberBalanceLogMismatchSchema>

/** 对账响应：mismatches 为空数组表示账账相符 */
export const SysMemberBalanceLogReconcileRespSchema = z.object({
    checkDate: z.string().nullish(),
    checkedCount: z.number().nullish(),
    mismatches: z.array(SysMemberBalanceLogMismatchSchema),
})
export type SysMemberBalanceLogReconcileRespDTO = z.infer<typeof SysMemberBalanceLogReconcileRespSchema>

/** 导出响应：内容直接以文本返回，由前端落盘为文件 */
export const SysMemberBalanceLogExportRespSchema = z.object({
    filename: z.string().nullish(),
    content: z.string().nullish(),
})
export type SysMemberBalanceLogExportRespDTO = z.infer<typeof SysMemberBalanceLogExportRespSchema>
