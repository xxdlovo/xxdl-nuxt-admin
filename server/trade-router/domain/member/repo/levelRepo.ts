/**
 * 会员等级 mapper（数据访问层）。
 */
import { and, asc, eq } from 'drizzle-orm'
import { sysMemberLevel } from '#server/drizzle/schema'
import { asDb, type AppExecutor } from '#server/drizzle/db'

export type LevelRow = typeof sysMemberLevel.$inferSelect
export type LevelInsert = typeof sysMemberLevel.$inferInsert

export function levelRepo(executor: AppExecutor) {
  const db = asDb(executor)

  return {
    async insert(values: LevelInsert) {
      return await db.insert(sysMemberLevel).values(values)
    },

    async findById(id: string): Promise<LevelRow | null> {
      const rows = await db
        .select()
        .from(sysMemberLevel)
        .where(and(eq(sysMemberLevel.id, id), eq(sysMemberLevel.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    async findByCode(code: string): Promise<LevelRow | null> {
      const rows = await db
        .select()
        .from(sysMemberLevel)
        .where(and(eq(sysMemberLevel.code, code), eq(sysMemberLevel.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    /** 启用中的等级，按 sortOrder 升序（下拉与等级展示用） */
    async listEnabled(): Promise<LevelRow[]> {
      return await db
        .select()
        .from(sysMemberLevel)
        .where(and(eq(sysMemberLevel.status, 1), eq(sysMemberLevel.isDeleted, 0)))
        .orderBy(asc(sysMemberLevel.sortOrder), asc(sysMemberLevel.createdAt))
    }
  }
}

export type LevelRepo = ReturnType<typeof levelRepo>
