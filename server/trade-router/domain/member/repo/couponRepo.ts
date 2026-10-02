/**
 * 优惠码 mapper（数据访问层）。
 *
 * 使用次数累计放在条件更新里（`max_use = 0 or used_count < max_use`），
 * 因此并发核销不会超过总量上限。
 */
import { and, asc, eq, sql } from 'drizzle-orm'
import { sysMemberCoupon } from '#server/drizzle/schema'
import { asDb, type AppExecutor } from '#server/drizzle/db'
import { affectedRows } from '../../wallet/repo/sqlUtils'

export type CouponRow = typeof sysMemberCoupon.$inferSelect
export type CouponInsert = typeof sysMemberCoupon.$inferInsert

export function couponRepo(executor: AppExecutor) {
  const db = asDb(executor)

  return {
    async insert(values: CouponInsert) {
      return await db.insert(sysMemberCoupon).values(values)
    },

    async findById(id: string): Promise<CouponRow | null> {
      const rows = await db
        .select()
        .from(sysMemberCoupon)
        .where(and(eq(sysMemberCoupon.id, id), eq(sysMemberCoupon.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    async findByCode(code: string): Promise<CouponRow | null> {
      const rows = await db
        .select()
        .from(sysMemberCoupon)
        .where(and(eq(sysMemberCoupon.code, code), eq(sysMemberCoupon.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    /** 可用优惠码：启用中、在有效期内、未超过总量上限 */
    async findUsableByCode(code: string): Promise<CouponRow | null> {
      const rows = await db
        .select()
        .from(sysMemberCoupon)
        .where(and(
          eq(sysMemberCoupon.code, code),
          eq(sysMemberCoupon.isDeleted, 0),
          eq(sysMemberCoupon.status, 1),
          sql`(${sysMemberCoupon.validFrom} is null or ${sysMemberCoupon.validFrom} <= now())`,
          sql`(${sysMemberCoupon.validTo} is null or ${sysMemberCoupon.validTo} > now())`,
          sql`(${sysMemberCoupon.maxUse} = 0 or ${sysMemberCoupon.usedCount} < ${sysMemberCoupon.maxUse})`
        ))
        .limit(1)

      return rows[0] ?? null
    },

    /** 核销次数 +1（带总量守卫） */
    async incrementUsedCount(couponId: string, operatorId: string | null) {
      const result: unknown = await db
        .update(sysMemberCoupon)
        .set({
          usedCount: sql`${sysMemberCoupon.usedCount} + 1`,
          updatedBy: operatorId
        })
        .where(and(
          eq(sysMemberCoupon.id, couponId),
          sql`(${sysMemberCoupon.maxUse} = 0 or ${sysMemberCoupon.usedCount} < ${sysMemberCoupon.maxUse})`
        ))

      return affectedRows(result)
    },

    /** 作废：status 置 2（与 DDL 注释一致：0 禁用 / 1 启用 / 2 已作废） */
    async markVoid(couponId: string, operatorId: string | null) {
      const result: unknown = await db
        .update(sysMemberCoupon)
        .set({ status: 2, updatedBy: operatorId })
        .where(and(
          eq(sysMemberCoupon.id, couponId),
          eq(sysMemberCoupon.isDeleted, 0),
          sql`${sysMemberCoupon.status} <> 2`
        ))

      return affectedRows(result)
    },

    /** 启用中的优惠码列表（后台选择器用） */
    async listEnabled(): Promise<CouponRow[]> {
      return await db
        .select()
        .from(sysMemberCoupon)
        .where(and(eq(sysMemberCoupon.status, 1), eq(sysMemberCoupon.isDeleted, 0)))
        .orderBy(asc(sysMemberCoupon.createdAt))
    }
  }
}

export type CouponRepo = ReturnType<typeof couponRepo>
