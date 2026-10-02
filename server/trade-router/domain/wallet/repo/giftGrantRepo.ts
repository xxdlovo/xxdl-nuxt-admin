/**
 * 赠送金批次 mapper（数据访问层）。
 *
 * 赠送金按「批次」管理，才能表达「某一批 3 个月后过期」：
 * - 扣减按 `expire_at` 升序（永不过期的批次排在最后），先到期先扣；
 * - 过期任务把批次置为 `expired` 并清零 `remain_amount`，再扣减钱包赠送金余额。
 */
import { and, asc, eq, lte, sql } from 'drizzle-orm'
import { sysMemberGiftGrant } from '#server/drizzle/schema'
import { asDb, type AppExecutor } from '#server/drizzle/db'
import { affectedRows } from './sqlUtils'

export type GiftGrantRow = typeof sysMemberGiftGrant.$inferSelect
export type GiftGrantInsert = typeof sysMemberGiftGrant.$inferInsert

export function giftGrantRepo(executor: AppExecutor) {
  const db = asDb(executor)

  return {
    async insert(values: GiftGrantInsert) {
      return await db.insert(sysMemberGiftGrant).values(values)
    },

    async findByBizNo(bizNo: string): Promise<GiftGrantRow | null> {
      const rows = await db
        .select()
        .from(sysMemberGiftGrant)
        .where(eq(sysMemberGiftGrant.bizNo, bizNo))
        .limit(1)

      return rows[0] ?? null
    },

    /** 可用批次：永不过期的排最后，其余按最早到期优先 */
    async listActiveByUser(userId: string): Promise<GiftGrantRow[]> {
      return await db
        .select()
        .from(sysMemberGiftGrant)
        .where(and(
          eq(sysMemberGiftGrant.userId, userId),
          eq(sysMemberGiftGrant.status, 'active'),
          eq(sysMemberGiftGrant.isDeleted, 0),
          sql`${sysMemberGiftGrant.remainAmount} > 0`
        ))
        .orderBy(
          sql`${sysMemberGiftGrant.expireAt} is null`,
          asc(sysMemberGiftGrant.expireAt),
          asc(sysMemberGiftGrant.createdAt)
        )
    },

    /** 扣减某批次的剩余额度（条件更新，余额不足则 0 行） */
    async consumeRemain(input: { grantId: string; amount: string; operatorId: string | null }) {
      const result: unknown = await db
        .update(sysMemberGiftGrant)
        .set({
          remainAmount: sql`${sysMemberGiftGrant.remainAmount} - ${input.amount}`,
          updatedBy: input.operatorId
        })
        .where(and(
          eq(sysMemberGiftGrant.id, input.grantId),
          sql`${sysMemberGiftGrant.remainAmount} >= ${input.amount}`
        ))

      return affectedRows(result)
    },

    /** 批次用尽 → 置为 used（幂等） */
    async markUsedIfEmpty(grantId: string, operatorId: string | null) {
      const result: unknown = await db
        .update(sysMemberGiftGrant)
        .set({ status: 'used', updatedBy: operatorId })
        .where(and(
          eq(sysMemberGiftGrant.id, grantId),
          eq(sysMemberGiftGrant.status, 'active'),
          sql`${sysMemberGiftGrant.remainAmount} <= 0`
        ))

      return affectedRows(result)
    },

    /** 已过期但仍有剩余的批次（过期任务扫描用） */
    async listExpiredActive(now: string, limit: number): Promise<GiftGrantRow[]> {
      return await db
        .select()
        .from(sysMemberGiftGrant)
        .where(and(
          eq(sysMemberGiftGrant.status, 'active'),
          eq(sysMemberGiftGrant.isDeleted, 0),
          sql`${sysMemberGiftGrant.remainAmount} > 0`,
          sql`${sysMemberGiftGrant.expireAt} is not null`,
          lte(sysMemberGiftGrant.expireAt, now)
        ))
        .orderBy(asc(sysMemberGiftGrant.expireAt))
        .limit(limit)
    },

    /** 标记批次过期（条件更新保证只处理一次） */
    async markExpired(grantId: string, operatorId: string | null) {
      const result: unknown = await db
        .update(sysMemberGiftGrant)
        .set({ status: 'expired', remainAmount: '0.00', updatedBy: operatorId })
        .where(and(
          eq(sysMemberGiftGrant.id, grantId),
          eq(sysMemberGiftGrant.status, 'active')
        ))

      return affectedRows(result)
    },

    /** 未过期批次的剩余总额（对账用：应与钱包赠送金余额一致） */
    async sumActiveRemain(userId: string) {
      const rows = await db
        .select({ total: sql<string>`coalesce(sum(${sysMemberGiftGrant.remainAmount}), 0)` })
        .from(sysMemberGiftGrant)
        .where(and(
          eq(sysMemberGiftGrant.userId, userId),
          eq(sysMemberGiftGrant.status, 'active'),
          eq(sysMemberGiftGrant.isDeleted, 0)
        ))

      return rows[0]?.total ?? '0.00'
    }
  }
}

export type GiftGrantRepo = ReturnType<typeof giftGrantRepo>
