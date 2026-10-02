import { z } from 'zod'
import { SysMemberBalanceLogBaseSchema } from './common'
import { ApiRequestSchema } from '#shared/types/common'

/**
 * 新增流水：正常链路由余额服务写入（dedupKey 由服务生成），
 * 这里保留标准结构，便于人工补录 / 数据修复时校验入参。
 */
export const SysMemberBalanceLogAddSchema =
    SysMemberBalanceLogBaseSchema.pick({
        userId: true,
        account: true,
        direction: true,
        amount: true,
        balanceBefore: true,
        balanceAfter: true,
        bizType: true,
        bizNo: true,
        dedupKey: true,
        operatorId: true,
        reason: true,
        remark: true,
    }).extend({
        id: SysMemberBalanceLogBaseSchema.shape.id.nonoptional(),
        userId: z.string().min(1, 'form.required').max(36, 'form.required'),
        account: z.string().min(1, 'form.required').max(20, 'form.required'),
        direction: z.string().min(1, 'form.required').max(10, 'form.required'),
        amount: z.union([z.string(), z.number()]),
        balanceBefore: z.union([z.string(), z.number()]),
        balanceAfter: z.union([z.string(), z.number()]),
        bizType: z.string().min(1, 'form.required').max(30, 'form.required'),
        bizNo: z.string().min(1, 'form.required').max(64, 'form.required'),
        dedupKey: z.string().min(1, 'form.required').max(128, 'form.required'),
        operatorId: z.string().max(36).nullish(),
        reason: z.string().max(255).nullish(),
        remark: z.string().max(255).nullish(),
    })
export type SysMemberBalanceLogAddDTO = z.infer<typeof SysMemberBalanceLogAddSchema>

// 修改：在新增基础上让 id 必填（流水原则上不可改，仅用于修复）
export const SysMemberBalanceLogUpdateSchema = SysMemberBalanceLogAddSchema.extend({
    id: z.string().nonempty('form.id.required'),
})
export type SysMemberBalanceLogUpdateDTO = z.infer<typeof SysMemberBalanceLogUpdateSchema>

/**
 * 查询条件。createdFrom / createdTo 不是表字段：
 * buildWhereBySchema 会自动跳过，由 Repo 的 pageWithRange 用区间条件消费。
 */
export const SysMemberBalanceLogQuerySchema = SysMemberBalanceLogBaseSchema.pick({
    id: true,
    userId: true,
    account: true,
    direction: true,
    bizType: true,
    bizNo: true,
}).extend({
    createdFrom: z.string().nullish(),
    createdTo: z.string().nullish(),
})
export type SysMemberBalanceLogQueryDTO = z.infer<typeof SysMemberBalanceLogQuerySchema>

// 分页查询：查询条件 + 分页参数
export const SysMemberBalanceLogPageQuerySchema =
    SysMemberBalanceLogQuerySchema.extend(ApiRequestSchema.shape)
export type SysMemberBalanceLogPageQueryDTO = z.infer<typeof SysMemberBalanceLogPageQuerySchema>

/**
 * 导出：与查询同字段，额外用 limit 限制单次导出行数上限，
 * 避免大账号池导出把内存打满（上限 50000，默认 5000）。
 */
export const SysMemberBalanceLogExportSchema = SysMemberBalanceLogQuerySchema.extend({
    limit: z.number().int().min(1).max(50000).default(5000),
})
export type SysMemberBalanceLogExportDTO = z.infer<typeof SysMemberBalanceLogExportSchema>

/** 汇总：按用户 + 时间区间统计各业务方向的收支合计 */
export const SysMemberBalanceLogSummarySchema = z.object({
    userId: z.string().max(36).nullish(),
    createdFrom: z.string().nullish(),
    createdTo: z.string().nullish(),
})
export type SysMemberBalanceLogSummaryDTO = z.infer<typeof SysMemberBalanceLogSummarySchema>

/** 对账：按用户 + 日期核对钱包余额与流水累计余额是否一致 */
export const SysMemberBalanceLogReconcileSchema = z.object({
    userId: z.string().max(36).nullish(),
    /** 对账日期 YYYY-MM-DD */
    checkDate: z.string().max(10).regex(/^\d{4}-\d{2}-\d{2}$/, 'form.required').nullish(),
})
export type SysMemberBalanceLogReconcileDTO = z.infer<typeof SysMemberBalanceLogReconcileSchema>

/**
 * 未到账充值补偿：已支付但未入账的充值单需要重新触发入账。
 * outTradeNo 精确命中单笔；userId 用于批量补偿；createdFrom / createdTo 只做区间收窄，
 * 单给区间会命中全库未到账单，因此 refine 要求 outTradeNo 与 userId 至少给一个。
 */
export const SysMemberBalanceLogRechargeRetrySchema = z
    .object({
        outTradeNo: z.string().max(64).nullish(),
        userId: z.string().max(36).nullish(),
        createdFrom: z.string().nullish(),
        createdTo: z.string().nullish(),
    })
    .refine(data => Boolean(data.outTradeNo) || Boolean(data.userId), {
        message: 'form.required',
        path: ['outTradeNo'],
    })
export type SysMemberBalanceLogRechargeRetryDTO = z.infer<typeof SysMemberBalanceLogRechargeRetrySchema>
