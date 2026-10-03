/**
 * 订单 mapper（数据访问层）。
 *
 * 所有状态推进都是**条件 UPDATE + affectedRows**：
 * - `markCompleted` 只在 `status = 'WP'` 时生效 → 回调重放、后台重复确认都只成功一次；
 * - `markClosed` / `markFailed` 同理，只从 `WP` 出发；
 * - `markFulfilled` 只在已支付且「待交付」时生效。
 */
import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { sysOrder } from '#server/drizzle/schema'
import { asDb, type AppExecutor } from '#server/drizzle/db'
import { affectedRows } from '../../wallet/repo/sqlUtils'

export type OrderRow = typeof sysOrder.$inferSelect
export type OrderInsert = typeof sysOrder.$inferInsert

/** WP 待支付 / OD 已完成 / CL 已关闭 / FL 发起失败 */
const STATUS_PENDING = 'WP'
const STATUS_COMPLETED = 'OD'

export function orderRepo(executor: AppExecutor) {
  const db = asDb(executor)

  return {
    async insert(values: OrderInsert) {
      return await db.insert(sysOrder).values(values)
    },

    async findById(id: string): Promise<OrderRow | null> {
      const rows = await db
        .select()
        .from(sysOrder)
        .where(and(eq(sysOrder.id, id), eq(sysOrder.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    async findByOrderNo(orderNo: string): Promise<OrderRow | null> {
      const rows = await db
        .select()
        .from(sysOrder)
        .where(and(eq(sysOrder.orderNo, orderNo), eq(sysOrder.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    /** 下单幂等：同一 requestId 只允许存在一单 */
    async findByRequestId(requestId: string): Promise<OrderRow | null> {
      const rows = await db
        .select()
        .from(sysOrder)
        .where(and(eq(sysOrder.requestId, requestId), eq(sysOrder.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    /** WP → OD（余额确认 / 在线支付成功都走这里） */
    async markCompleted(values: {
      id: string
      paidAt: string
      finishedAt: string
      operatorId?: string | null
      payOrderId?: string | null
      payChannelCode?: string | null
    }) {
      const result: unknown = await db
        .update(sysOrder)
        .set({
          status: STATUS_COMPLETED,
          paidAt: values.paidAt,
          finishedAt: values.finishedAt,
          payOrderId: values.payOrderId ?? undefined,
          payChannelCode: values.payChannelCode ?? undefined,
          updatedBy: values.operatorId ?? null
        })
        .where(and(eq(sysOrder.id, values.id), eq(sysOrder.status, STATUS_PENDING)))

      return affectedRows(result)
    },

    /** WP → CL */
    async markClosed(values: {
      id: string
      closedAt: string
      closeReason: string | null
      operatorId?: string | null
    }) {
      const result: unknown = await db
        .update(sysOrder)
        .set({
          status: 'CL',
          closedAt: values.closedAt,
          closeReason: values.closeReason,
          updatedBy: values.operatorId ?? null
        })
        .where(and(eq(sysOrder.id, values.id), eq(sysOrder.status, STATUS_PENDING)))

      return affectedRows(result)
    },

    /** WP → FL（在线支付单创建失败） */
    async markFailed(values: {
      id: string
      failReason: string
      operatorId?: string | null
    }) {
      const result: unknown = await db
        .update(sysOrder)
        .set({
          status: 'FL',
          failReason: values.failReason,
          updatedBy: values.operatorId ?? null
        })
        .where(and(eq(sysOrder.id, values.id), eq(sysOrder.status, STATUS_PENDING)))

      return affectedRows(result)
    },

    /** 回填支付单信息（在线支付） */
    async attachPayOrder(values: {
      id: string
      payOrderId: string
      payChannelCode: string | null
      operatorId?: string | null
    }) {
      const result: unknown = await db
        .update(sysOrder)
        .set({
          payOrderId: values.payOrderId,
          payChannelCode: values.payChannelCode,
          updatedBy: values.operatorId ?? null
        })
        .where(eq(sysOrder.id, values.id))

      return affectedRows(result)
    },

    /** 回填冻结信息（余额支付：冻结拆分结果） */
    async attachFreeze(values: {
      id: string
      freezeId: string
      giftAmount: string
      rechargeAmount: string
      operatorId?: string | null
    }) {
      const result: unknown = await db
        .update(sysOrder)
        .set({
          freezeId: values.freezeId,
          giftAmount: values.giftAmount,
          rechargeAmount: values.rechargeAmount,
          updatedBy: values.operatorId ?? null
        })
        .where(eq(sysOrder.id, values.id))

      return affectedRows(result)
    },

    /** 待交付 → 已交付（必须已支付） */
    async markFulfilled(values: {
      id: string
      fulfilledAt: string
      fulfillRemark: string | null
      operatorId?: string | null
    }) {
      const result: unknown = await db
        .update(sysOrder)
        .set({
          fulfillStatus: 'delivered',
          fulfilledAt: values.fulfilledAt,
          fulfillRemark: values.fulfillRemark,
          fulfillOperatorId: values.operatorId ?? null,
          updatedBy: values.operatorId ?? null
        })
        .where(and(
          eq(sysOrder.id, values.id),
          eq(sysOrder.status, STATUS_COMPLETED),
          eq(sysOrder.fulfillStatus, 'pending')
        ))

      return affectedRows(result)
    },

    /** 超时未支付：给 order:expire-close 任务扫描 */
    async listExpiredPending(limit: number, now: string): Promise<OrderRow[]> {
      return await db
        .select()
        .from(sysOrder)
        .where(and(
          eq(sysOrder.isDeleted, 0),
          eq(sysOrder.status, STATUS_PENDING),
          lte(sysOrder.expireAt, now)
        ))
        .orderBy(sysOrder.expireAt)
        .limit(limit)
    },

    /** 会员自助分页（只查自己的单） */
    async pageByUser(params: {
      userId: string
      status?: string | null
      fulfillStatus?: string | null
      page: number
      pageSize: number
    }) {
      const conditions = [eq(sysOrder.isDeleted, 0), eq(sysOrder.userId, params.userId)]

      if (params.status) {
        conditions.push(eq(sysOrder.status, params.status))
      }
      if (params.fulfillStatus) {
        conditions.push(eq(sysOrder.fulfillStatus, params.fulfillStatus))
      }

      const totalRows = await db
        .select({ total: count() })
        .from(sysOrder)
        .where(and(...conditions))

      const list = await db
        .select()
        .from(sysOrder)
        .where(and(...conditions))
        .orderBy(desc(sysOrder.createdAt))
        .limit(params.pageSize)
        .offset((params.page - 1) * params.pageSize)

      return { total: Number(totalRows[0]?.total ?? 0), list }
    },

    /**
     * 看板用：待支付数（`WP`）+ 待交付服务订单数（`OD` 且 `pending`）。
     *
     * 两项都是 `is_deleted = 0` 上的全表聚合，条件互不重叠，所以合并成**一条**
     * `SUM(CASE WHEN ... THEN 1 ELSE 0 END)` 查询，不再是两段独立 COUNT。
     */
    async countPendingOverview() {
      const rows = await db
        .select({
          pendingCount: sql<number>`coalesce(sum(case when ${sysOrder.status} = 'WP' then 1 else 0 end), 0)`,
          pendingFulfillCount: sql<number>`coalesce(sum(case when ${sysOrder.status} = 'OD' and ${sysOrder.fulfillStatus} = 'pending' then 1 else 0 end), 0)`
        })
        .from(sysOrder)
        .where(and(eq(sysOrder.isDeleted, 0)))

      return {
        pendingCount: Number(rows[0]?.pendingCount ?? 0),
        pendingFulfillCount: Number(rows[0]?.pendingFulfillCount ?? 0)
      }
    },

    /** 区间内订单数与成交额（成交额只统计已完成订单的应付金额） */
    async sumByRange(range: { createdFrom?: string | null; createdTo?: string | null }) {
      const conditions = [eq(sysOrder.isDeleted, 0)]

      if (range.createdFrom) {
        conditions.push(gte(sysOrder.createdAt, range.createdFrom))
      }
      if (range.createdTo) {
        conditions.push(lte(sysOrder.createdAt, range.createdTo))
      }

      const rows = await db
        .select({
          totalCount: count(),
          totalAmount: sql<string>`coalesce(sum(case when ${sysOrder.status} = 'OD' then ${sysOrder.payAmount} else 0 end), 0)`
        })
        .from(sysOrder)
        .where(and(...conditions))

      return {
        totalCount: Number(rows[0]?.totalCount ?? 0),
        totalAmount: String(rows[0]?.totalAmount ?? '0.00')
      }
    }
  }
}

export type OrderRepo = ReturnType<typeof orderRepo>
