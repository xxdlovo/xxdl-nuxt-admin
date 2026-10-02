/**
 * 充值单 mapper（数据访问层）。
 *
 * 与支付模块的关系：`out_trade_no` 与 `sys_pay_order.out_trade_no` 一一对应，
 * 回调到账时按 `out_trade_no` 找到充值单，再走 WalletService 入账（幂等）。
 */
import { and, desc, eq, sql } from 'drizzle-orm'
import { sysMemberRecharge, sysPayOrder } from '#server/drizzle/schema'
import { asDb, type AppExecutor } from '#server/drizzle/db'
import { affectedRows } from './sqlUtils'

export type RechargeRow = typeof sysMemberRecharge.$inferSelect
export type RechargeInsert = typeof sysMemberRecharge.$inferInsert

export function rechargeRepo(executor: AppExecutor) {
  const db = asDb(executor)

  return {
    async insert(values: RechargeInsert) {
      return await db.insert(sysMemberRecharge).values(values)
    },

    async findByOutTradeNo(outTradeNo: string): Promise<RechargeRow | null> {
      const rows = await db
        .select()
        .from(sysMemberRecharge)
        .where(eq(sysMemberRecharge.outTradeNo, outTradeNo))
        .limit(1)

      return rows[0] ?? null
    },

    async findById(id: string): Promise<RechargeRow | null> {
      const rows = await db
        .select()
        .from(sysMemberRecharge)
        .where(eq(sysMemberRecharge.id, id))
        .limit(1)

      return rows[0] ?? null
    },

    /**
     * 标记「已支付且已到账」。
     * WHERE 排除已 OD 的行，因此重复回调只有第一次会生效（affectedRows 为 1）。
     */
    async markCredited(input: {
      id: string
      paidAt: string
      creditedAt: string
      payOrderId: string | null
      payChannelCode: string | null
      operatorId: string | null
    }) {
      const result: unknown = await db
        .update(sysMemberRecharge)
        .set({
          status: 'OD',
          paidAt: input.paidAt,
          creditedAt: input.creditedAt,
          payOrderId: input.payOrderId,
          payChannelCode: input.payChannelCode,
          failReason: null,
          updatedBy: input.operatorId
        })
        .where(and(
          eq(sysMemberRecharge.id, input.id),
          sql`${sysMemberRecharge.status} <> 'OD'`
        ))

      return affectedRows(result)
    },

    /** 记录支付单信息（发起支付成功后回填，便于对账） */
    async attachPayOrder(input: {
      id: string
      payOrderId: string | null
      payChannelCode: string | null
      operatorId: string | null
    }) {
      const result: unknown = await db
        .update(sysMemberRecharge)
        .set({
          payOrderId: input.payOrderId,
          payChannelCode: input.payChannelCode,
          updatedBy: input.operatorId
        })
        .where(eq(sysMemberRecharge.id, input.id))

      return affectedRows(result)
    },

    /** 关闭未支付充值单（幂等：仅 WP 可关闭） */
    async markClosed(input: { id: string; reason: string | null; operatorId: string | null }) {
      const result: unknown = await db
        .update(sysMemberRecharge)
        .set({ status: 'CL', failReason: input.reason, updatedBy: input.operatorId })
        .where(and(
          eq(sysMemberRecharge.id, input.id),
          eq(sysMemberRecharge.status, 'WP')
        ))

      return affectedRows(result)
    },

    /** 标记失败（发起支付就失败时调用） */
    async markFailed(input: { id: string; reason: string | null; operatorId: string | null }) {
      const result: unknown = await db
        .update(sysMemberRecharge)
        .set({ status: 'FL', failReason: input.reason, updatedBy: input.operatorId })
        .where(and(
          eq(sysMemberRecharge.id, input.id),
          eq(sysMemberRecharge.status, 'WP')
        ))

      return affectedRows(result)
    },

    /**
     * 需要补偿的充值单：本地仍是待支付，但对应的支付单已经支付成功。
     * 用于「回调丢了 / 到账中断」的自愈（幂等键保证不会重复到账）。
     */
    async listPendingWithPaidOrder(limit: number) {
      return await db
        .select({
          rechargeId: sysMemberRecharge.id,
          outTradeNo: sysMemberRecharge.outTradeNo,
          userId: sysMemberRecharge.userId,
          payOrderId: sysPayOrder.id,
          channelCode: sysPayOrder.channelCode,
          paidAt: sysPayOrder.paidAt
        })
        .from(sysMemberRecharge)
        .innerJoin(sysPayOrder, eq(sysPayOrder.outTradeNo, sysMemberRecharge.outTradeNo))
        .where(and(
          eq(sysMemberRecharge.status, 'WP'),
          eq(sysMemberRecharge.isDeleted, 0),
          eq(sysPayOrder.status, 'OD'),
          eq(sysPayOrder.isDeleted, 0)
        ))
        .orderBy(desc(sysMemberRecharge.createdAt))
        .limit(limit)
    }
  }
}

export type RechargeRepo = ReturnType<typeof rechargeRepo>
