/**
 * 支付订单 mapper（数据访问层）。
 *
 * 职责边界：
 * - 这是支付模块里唯一允许出现 drizzle 查询 / 原生 SQL 的地方（「SQL 统一放 mapper 层」）；
 * - 接收 `AppExecutor`（连接或事务）而不是 tRPC `Context`：回调路由 /api/pay/notify 没有 tRPC 上下文，
 *   领域层与路由层都复用同一份 mapper，避免同一张表出现第二份 SQL；
 * - 只负责取数与写数，不做业务判断（状态能否流转、金额是否一致等在 Service / Dispatcher）。
 */
import { and, asc, desc, eq, ne, sql } from 'drizzle-orm'
import { sysPayOrder } from '#server/drizzle/schema'
import { asDb, type AppExecutor } from '#server/drizzle/db'

export type PayOrderRow = typeof sysPayOrder.$inferSelect
export type PayOrderInsert = typeof sysPayOrder.$inferInsert
export type PayOrderUpdate = Partial<PayOrderInsert>

/** 条件更新需要的「实际置为已支付」字段（通知计数与时间戳由 mapper 自己拼 SQL） */
export type MarkPaidValues = {
  paidAt: string
  lastNotifyAt: string
  providerStatus?: string | null
  providerOrderId?: string | null
  transactionId?: string | null
  providerData?: unknown
}

/** mysql2 的写结果 → 受影响行数 */
function affectedRows(result: unknown) {
  const first = Array.isArray(result) ? result[0] : result
  return Number((first as { affectedRows?: number } | undefined)?.affectedRows ?? 0)
}

export function payOrderRepo(executor: AppExecutor) {
  const db = asDb(executor)

  return {
    async findById(orderId: string): Promise<PayOrderRow | null> {
      const rows = await db
        .select()
        .from(sysPayOrder)
        .where(and(eq(sysPayOrder.id, orderId), eq(sysPayOrder.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    async findByOutTradeNo(outTradeNo: string): Promise<PayOrderRow | null> {
      const rows = await db
        .select()
        .from(sysPayOrder)
        .where(and(eq(sysPayOrder.outTradeNo, outTradeNo), eq(sysPayOrder.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    async existsOutTradeNo(outTradeNo: string): Promise<boolean> {
      const rows = await db
        .select({ id: sysPayOrder.id })
        .from(sysPayOrder)
        .where(eq(sysPayOrder.outTradeNo, outTradeNo))
        .limit(1)

      return Boolean(rows[0])
    },

    async insert(values: PayOrderInsert) {
      return await db.insert(sysPayOrder).values(values)
    },

    async updateById(orderId: string, values: PayOrderUpdate) {
      return await db.update(sysPayOrder).set(values).where(eq(sysPayOrder.id, orderId))
    },

    /** 只刷新「最近查询时间」 */
    async touchLastQuery(orderId: string, now: string, operatorId: string | null) {
      return await db
        .update(sysPayOrder)
        .set({ lastQueryAt: now, updatedBy: operatorId })
        .where(eq(sysPayOrder.id, orderId))
    },

    /**
     * 幂等置为已支付：仅在订单还不是 OD 时生效，同时把通知计数 +1。
     * 返回受影响行数，调用方据此区分「首次支付」与「并发/重复回调」。
     */
    async markPaidIfPending(orderId: string, values: MarkPaidValues): Promise<number> {
      const result: unknown = await db
        .update(sysPayOrder)
        .set({
          status: 'OD',
          paidAt: values.paidAt,
          lastNotifyAt: values.lastNotifyAt,
          notifyCount: sql`${sysPayOrder.notifyCount} + 1`,
          providerStatus: values.providerStatus ?? null,
          providerOrderId: values.providerOrderId ?? null,
          transactionId: values.transactionId ?? null,
          providerData: values.providerData ?? null
        })
        .where(and(eq(sysPayOrder.id, orderId), ne(sysPayOrder.status, 'OD')))

      return affectedRows(result)
    },

    /**
     * 不改变资金结论的回调：通知计数 +1 并记录时间，可顺带同步平台状态。
     * 是否改本地状态由调用方（领域层）决定，mapper 只负责把值写下去。
     */
    async applyNotifyCountUpdate(orderId: string, values: {
      lastNotifyAt: string
      providerStatus?: string | null
      status?: string
      cancelledAt?: string
    }) {
      return await db
        .update(sysPayOrder)
        .set({
          notifyCount: sql`${sysPayOrder.notifyCount} + 1`,
          lastNotifyAt: values.lastNotifyAt,
          ...(values.providerStatus !== undefined ? { providerStatus: values.providerStatus } : {}),
          ...(values.status !== undefined ? { status: values.status } : {}),
          ...(values.cancelledAt !== undefined ? { cancelledAt: values.cancelledAt } : {})
        })
        .where(eq(sysPayOrder.id, orderId))
    },

    /** 过期未支付的订单（对账任务备用） */
    async listExpiredPending(now: string, limit: number): Promise<PayOrderRow[]> {
      return await db
        .select()
        .from(sysPayOrder)
        .where(and(
          eq(sysPayOrder.isDeleted, 0),
          eq(sysPayOrder.status, 'WP'),
          sql`${sysPayOrder.expireAt} is not null and ${sysPayOrder.expireAt} < ${now}`
        ))
        .orderBy(desc(sysPayOrder.createdAt))
        .limit(limit)
    }
  }
}

export type PayOrderRepo = ReturnType<typeof payOrderRepo>
