/**
 * 优惠码使用记录 mapper（数据访问层）。
 *
 * `(coupon_id, biz_no)` 唯一：同一笔业务只能锁一次券，天然幂等。
 * 状态机：locked（已锁定）→ used（已核销） / released（已释放）。
 */
import { and, count, desc, eq, sql } from 'drizzle-orm'
import { sysMemberCouponUse } from '#server/drizzle/schema'
import { asDb, type AppExecutor } from '#server/drizzle/db'
import { affectedRows } from '../../wallet/repo/sqlUtils'

export type CouponUseRow = typeof sysMemberCouponUse.$inferSelect
export type CouponUseInsert = typeof sysMemberCouponUse.$inferInsert

export function couponUseRepo(executor: AppExecutor) {
  const db = asDb(executor)

  return {
    async insert(values: CouponUseInsert) {
      return await db.insert(sysMemberCouponUse).values(values)
    },

    async findByBizNo(bizNo: string): Promise<CouponUseRow | null> {
      const rows = await db
        .select()
        .from(sysMemberCouponUse)
        .where(and(eq(sysMemberCouponUse.bizNo, bizNo), eq(sysMemberCouponUse.isDeleted, 0)))
        .orderBy(desc(sysMemberCouponUse.createdAt))
        .limit(1)

      return rows[0] ?? null
    },

    /** 某用户对某券的已用次数（per_user_limit 判定，只统计已核销的） */
    async countUsedByUser(couponId: string, userId: string): Promise<number> {
      const rows = await db
        .select({ total: count() })
        .from(sysMemberCouponUse)
        .where(and(
          eq(sysMemberCouponUse.couponId, couponId),
          eq(sysMemberCouponUse.userId, userId),
          eq(sysMemberCouponUse.status, 'used'),
          eq(sysMemberCouponUse.isDeleted, 0)
        ))

      return Number(rows[0]?.total ?? 0)
    },

    /** 已锁定但未核销的次数（判定「有没有占用中的券」） */
    async countLockedByUser(couponId: string, userId: string): Promise<number> {
      const rows = await db
        .select({ total: count() })
        .from(sysMemberCouponUse)
        .where(and(
          eq(sysMemberCouponUse.couponId, couponId),
          eq(sysMemberCouponUse.userId, userId),
          eq(sysMemberCouponUse.status, 'locked'),
          eq(sysMemberCouponUse.isDeleted, 0)
        ))

      return Number(rows[0]?.total ?? 0)
    },

    /** 锁定的券核销为已使用 */
    async markUsed(bizNo: string, now: string, operatorId: string | null) {
      const result: unknown = await db
        .update(sysMemberCouponUse)
        .set({ status: 'used', usedAt: now, updatedBy: operatorId })
        .where(and(
          eq(sysMemberCouponUse.bizNo, bizNo),
          eq(sysMemberCouponUse.status, 'locked')
        ))

      return affectedRows(result)
    },

    /** 锁定的券释放（充值关闭 / 消费失败） */
    async markReleased(bizNo: string, now: string, operatorId: string | null) {
      const result: unknown = await db
        .update(sysMemberCouponUse)
        .set({ status: 'released', releasedAt: now, updatedBy: operatorId })
        .where(and(
          eq(sysMemberCouponUse.bizNo, bizNo),
          eq(sysMemberCouponUse.status, 'locked')
        ))

      return affectedRows(result)
    },

    /** 某用户的券使用记录（我的优惠码页） */
    async listByUser(userId: string, limit = 100): Promise<CouponUseRow[]> {
      return await db
        .select()
        .from(sysMemberCouponUse)
        .where(and(eq(sysMemberCouponUse.userId, userId), eq(sysMemberCouponUse.isDeleted, 0)))
        .orderBy(desc(sysMemberCouponUse.createdAt))
        .limit(limit)
    },

    /** 统计某券的已核销次数（与 coupon.used_count 对账用） */
    async countUsed(couponId: string): Promise<number> {
      const rows = await db
        .select({ total: count() })
        .from(sysMemberCouponUse)
        .where(and(
          eq(sysMemberCouponUse.couponId, couponId),
          eq(sysMemberCouponUse.status, 'used'),
          eq(sysMemberCouponUse.isDeleted, 0)
        ))

      return Number(rows[0]?.total ?? 0)
    },

    /** 已被锁定的券 ID 集合（校验用） */
    async existsLocked(couponId: string, bizNo: string): Promise<boolean> {
      const rows = await db
        .select({ id: sysMemberCouponUse.id })
        .from(sysMemberCouponUse)
        .where(and(
          eq(sysMemberCouponUse.couponId, couponId),
          eq(sysMemberCouponUse.bizNo, bizNo),
          sql`${sysMemberCouponUse.status} = 'locked'`
        ))
        .limit(1)

      return Boolean(rows[0])
    }
  }
}

export type CouponUseRepo = ReturnType<typeof couponUseRepo>
