/**
 * 消费冻结单 mapper（数据访问层）。
 *
 * 状态机：FROZEN → CONFIRMED（确认实扣） / RELEASED（业务失败释放） / EXPIRED（超时释放）。
 * 所有状态流转都用**条件更新**（`WHERE status = 'FROZEN'`），靠 `affectedRows` 判定，
 * 保证同一张冻结单只可能被确认或释放一次。
 */
import { and, asc, eq, lte, sql } from 'drizzle-orm'
import { sysMemberFreeze } from '#server/drizzle/schema'
import { asDb, type AppExecutor } from '#server/drizzle/db'
import { affectedRows } from './sqlUtils'

export type FreezeRow = typeof sysMemberFreeze.$inferSelect
export type FreezeInsert = typeof sysMemberFreeze.$inferInsert

export function freezeRepo(executor: AppExecutor) {
  const db = asDb(executor)

  return {
    async insert(values: FreezeInsert) {
      return await db.insert(sysMemberFreeze).values(values)
    },

    async findByBizNo(bizNo: string): Promise<FreezeRow | null> {
      const rows = await db
        .select()
        .from(sysMemberFreeze)
        .where(eq(sysMemberFreeze.bizNo, bizNo))
        .limit(1)

      return rows[0] ?? null
    },

    async findById(id: string): Promise<FreezeRow | null> {
      const rows = await db
        .select()
        .from(sysMemberFreeze)
        .where(eq(sysMemberFreeze.id, id))
        .limit(1)

      return rows[0] ?? null
    },

    /** 冻结中 → 已确认实扣 */
    async markConfirmed(input: { id: string; now: string; operatorId: string | null }) {
      const result: unknown = await db
        .update(sysMemberFreeze)
        .set({ status: 'CONFIRMED', confirmedAt: input.now, updatedBy: input.operatorId })
        .where(and(
          eq(sysMemberFreeze.id, input.id),
          eq(sysMemberFreeze.status, 'FROZEN')
        ))

      return affectedRows(result)
    },

    /** 冻结中 → 已释放（RELEASED / EXPIRED） */
    async markReleased(input: {
      id: string
      now: string
      reason: string | null
      status: 'RELEASED' | 'EXPIRED'
      operatorId: string | null
    }) {
      const result: unknown = await db
        .update(sysMemberFreeze)
        .set({
          status: input.status,
          releasedAt: input.now,
          releaseReason: input.reason,
          updatedBy: input.operatorId
        })
        .where(and(
          eq(sysMemberFreeze.id, input.id),
          eq(sysMemberFreeze.status, 'FROZEN')
        ))

      return affectedRows(result)
    },

    /** 超时未确认的冻结单（定时任务扫描用） */
    async listExpiredFrozen(now: string, limit: number): Promise<FreezeRow[]> {
      return await db
        .select()
        .from(sysMemberFreeze)
        .where(and(
          eq(sysMemberFreeze.status, 'FROZEN'),
          eq(sysMemberFreeze.isDeleted, 0),
          sql`${sysMemberFreeze.expireAt} is not null`,
          lte(sysMemberFreeze.expireAt, now)
        ))
        .orderBy(asc(sysMemberFreeze.expireAt))
        .limit(limit)
    },

    /** 某用户冻结中的单据 */
    async listFrozenByUser(userId: string): Promise<FreezeRow[]> {
      return await db
        .select()
        .from(sysMemberFreeze)
        .where(and(
          eq(sysMemberFreeze.userId, userId),
          eq(sysMemberFreeze.status, 'FROZEN'),
          eq(sysMemberFreeze.isDeleted, 0)
        ))
        .orderBy(asc(sysMemberFreeze.createdAt))
    }
  }
}

export type FreezeRepo = ReturnType<typeof freezeRepo>
