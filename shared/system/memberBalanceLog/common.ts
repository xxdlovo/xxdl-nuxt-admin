import z from 'zod'

/**
 * 会员余额流水基础 Schema —— 与 sys_member_balance_log 表结构保持一致。
 * 流水由余额服务在事务内写入，管理端只读（查询 / 汇总 / 对账 / 导出），
 * 保留标准 Add / Update 仅为了模块结构一致与极端场景补录。
 * 金额字段均为 decimal(12,2)，用 string | number 兼容表单直接传数字。
 */
export const SysMemberBalanceLogBaseSchema = z.object({
    id: z.string().nullish(),
    userId: z.string().nullish(),
    /** 账户类型：recharge 充值本金 / gift 赠送金 */
    account: z.string().nullish(),
    /** 方向：IN 收入 / OUT 支出 */
    direction: z.string().nullish(),
    amount: z.union([z.string(), z.number()]).nullish(),
    /** 变动前余额 */
    balanceBefore: z.union([z.string(), z.number()]).nullish(),
    /** 变动后余额 */
    balanceAfter: z.union([z.string(), z.number()]).nullish(),
    /** 业务类型：recharge 充值 / consume 消费 / refund 退款 / adjust 人工调整 / freeze 冻结 / release 释放 */
    bizType: z.string().nullish(),
    bizNo: z.string().nullish().meta({ query: 'like' }),
    /** 幂等键，全表唯一（uk_member_log_dedup），保证同一业务只入账一次 */
    dedupKey: z.string().nullish(),
    /** 操作人（人工调整时写入） */
    operatorId: z.string().nullish(),
    reason: z.string().nullish().meta({ query: 'like' }),
    remark: z.string().nullish(),
    createdBy: z.string().nullish(),
    /** 创建时间 YYYY-MM-DD HH:mm:ss */
    createdAt: z.string().nullish(),
    updatedBy: z.string().nullish(),
    /** 更新时间 YYYY-MM-DD HH:mm:ss */
    updatedAt: z.string().nullish(),
    isDeleted: z.number().nullish(),
})
export type SysMemberBalanceLogDto = z.infer<typeof SysMemberBalanceLogBaseSchema>
