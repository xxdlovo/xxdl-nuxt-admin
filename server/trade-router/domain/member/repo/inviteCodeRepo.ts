/**
 * 邀请码 mapper（数据访问层）。
 *
 * 邀请码有两种来源：
 * - `system`：后台批量生成的通用码（owner_user_id 为空）；
 * - `member`：会员建档时自动生成的专属码（owner_user_id = 该会员）。
 * 使用次数靠条件更新累加，避免并发下超过 `max_use`。
 */
import { and, asc, eq, sql } from 'drizzle-orm'
import { sysMemberInviteCode } from '#server/drizzle/schema'
import { asDb, type AppExecutor } from '#server/drizzle/db'
import { affectedRows } from '../../wallet/repo/sqlUtils'

export type InviteCodeRow = typeof sysMemberInviteCode.$inferSelect
export type InviteCodeInsert = typeof sysMemberInviteCode.$inferInsert

export function inviteCodeRepo(executor: AppExecutor) {
  const db = asDb(executor)

  return {
    async insert(values: InviteCodeInsert) {
      return await db.insert(sysMemberInviteCode).values(values)
    },

    async findByCode(code: string): Promise<InviteCodeRow | null> {
      const rows = await db
        .select()
        .from(sysMemberInviteCode)
        .where(and(eq(sysMemberInviteCode.code, code), eq(sysMemberInviteCode.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    /** 可用邀请码：启用中、未过期、未超过最大使用次数 */
    async findUsableByCode(code: string): Promise<InviteCodeRow | null> {
      const rows = await db
        .select()
        .from(sysMemberInviteCode)
        .where(and(
          eq(sysMemberInviteCode.code, code),
          eq(sysMemberInviteCode.isDeleted, 0),
          eq(sysMemberInviteCode.status, 1),
          sql`(${sysMemberInviteCode.expireAt} is null or ${sysMemberInviteCode.expireAt} > now())`,
          sql`(${sysMemberInviteCode.maxUse} = 0 or ${sysMemberInviteCode.usedCount} < ${sysMemberInviteCode.maxUse})`
        ))
        .limit(1)

      return rows[0] ?? null
    },

    /** 使用次数 +1（带 max_use 守卫，返回受影响行数） */
    async incrementUsedCount(codeId: string, operatorId: string | null) {
      const result: unknown = await db
        .update(sysMemberInviteCode)
        .set({
          usedCount: sql`${sysMemberInviteCode.usedCount} + 1`,
          updatedBy: operatorId
        })
        .where(and(
          eq(sysMemberInviteCode.id, codeId),
          sql`(${sysMemberInviteCode.maxUse} = 0 or ${sysMemberInviteCode.usedCount} < ${sysMemberInviteCode.maxUse})`
        ))

      return affectedRows(result)
    },

    /** 会员专属码是否存在（限制每会员一枚） */
    async findByOwner(ownerUserId: string): Promise<InviteCodeRow | null> {
      const rows = await db
        .select()
        .from(sysMemberInviteCode)
        .where(and(
          eq(sysMemberInviteCode.ownerUserId, ownerUserId),
          eq(sysMemberInviteCode.isDeleted, 0)
        ))
        .orderBy(asc(sysMemberInviteCode.createdAt))
        .limit(1)

      return rows[0] ?? null
    }
  }
}

export type InviteCodeRepo = ReturnType<typeof inviteCodeRepo>
