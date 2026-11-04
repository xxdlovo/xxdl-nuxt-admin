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

/** 汇总里按业务类型聚合的一行 */
export const SysMemberBalanceLogSummaryItemSchema = z.object({
    bizType: z.string(),
    direction: z.string(),
    /** 业务类型的中文标签（服务端已翻译，前端直接展示） */
    label: z.string(),
    /** 该业务类型在本区间的金额合计 */
    total: z.string(),
})

/**
 * 汇总响应：与 `SysMemberBalanceLogService.summary()` 的真实出参一致。
 *
 * 注意：这里的字段必须跟随服务端实现 —— 该 procedure 没有声明 `.output()`，
 * 客户端类型是从返回值推断的，schema 漂移不会编译报错，只会让契约文档骗人
 * （历史上这里留着 walletTotal/ledgerTotal/mismatchCount 等早已不存在的字段）。
 */
export const SysMemberBalanceLogSummaryRespSchema = z.object({
    items: z.array(SysMemberBalanceLogSummaryItemSchema),
    totalIn: z.string(),
    totalOut: z.string(),
    netTotal: z.string(),
    /**
     * 待补偿的未到账充值条数（待支付充值单 + 支付单已支付，服务端一次 COUNT(*)）。
     * 流水页平常只需要这个数字，不必每次加载都跑全量对账 reconcile。
     */
    pendingRechargeCount: z.number().int().nonnegative(),
})
export type SysMemberBalanceLogSummaryRespDTO = z.infer<typeof SysMemberBalanceLogSummaryRespSchema>

/** 单个对账差异项：**按账户**给出的钱包余额与流水累计余额差额 */
export const SysMemberBalanceLogMismatchSchema = z.object({
    userId: z.string().nullish(),
    /** 不一致的账户：recharge 充值金 / gift 赠送金（逐账户核对，避免两账户对冲掩盖错误） */
    account: z.string().nullish(),
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
    /** 待补偿充值条数（与 summary 同源，便于对账弹窗一并展示） */
    pendingRechargeCount: z.number().int().nonnegative().nullish(),
})
export type SysMemberBalanceLogReconcileRespDTO = z.infer<typeof SysMemberBalanceLogReconcileRespSchema>

/** 导出响应：内容直接以文本返回，由前端落盘为文件 */
export const SysMemberBalanceLogExportRespSchema = z.object({
    filename: z.string().nullish(),
    content: z.string().nullish(),
})
export type SysMemberBalanceLogExportRespDTO = z.infer<typeof SysMemberBalanceLogExportRespSchema>
