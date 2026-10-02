/**
 * 余额流水 mapper（数据访问层）。
 *
 * 流水表是**只增不改**的资金凭证：
 * - `insert` 依赖 `uk_member_log_dedup` 唯一索引做幂等，重复事件会抛 ER_DUP_ENTRY，
 *   由领域层捕获并解释为「已入账」；
 * - 汇总查询用于对账（按账户汇总净额）与财务看板。
 */
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { sysMemberBalanceLog } from '#server/drizzle/schema'
import { asDb, type AppExecutor } from '#server/drizzle/db'

export type BalanceLogRow = typeof sysMemberBalanceLog.$inferSelect
export type BalanceLogInsert = typeof sysMemberBalanceLog.$inferInsert

export function balanceLogRepo(executor: AppExecutor) {
  const db = asDb(executor)

  return {
    async insert(values: BalanceLogInsert) {
      return await db.insert(sysMemberBalanceLog).values(values)
    },

    async existsByDedupKey(dedupKey: string): Promise<boolean> {
      const rows = await db
        .select({ id: sysMemberBalanceLog.id })
        .from(sysMemberBalanceLog)
        .where(eq(sysMemberBalanceLog.dedupKey, dedupKey))
        .limit(1)

      return Boolean(rows[0])
    },

    /** 单个用户单个账户的流水净额（收入 - 支出），对账用 */
    async sumNetByUser(userId: string) {
      const rows = await db
        .select({
          account: sysMemberBalanceLog.account,
          net: sql<string>`coalesce(sum(case when ${sysMemberBalanceLog.direction} = 'in' then ${sysMemberBalanceLog.amount} else -${sysMemberBalanceLog.amount} end), 0)`
        })
        .from(sysMemberBalanceLog)
        .where(and(
          eq(sysMemberBalanceLog.userId, userId),
          eq(sysMemberBalanceLog.isDeleted, 0)
        ))
        .groupBy(sysMemberBalanceLog.account)

      return rows
    },

    /**
     * 全部用户的流水净额（一次查询完成对账，避免逐用户回表）。
     * 返回形如 `[{ userId, account, net }]`。
     */
    async sumNetGroupByUser() {
      return await db
        .select({
          userId: sysMemberBalanceLog.userId,
          account: sysMemberBalanceLog.account,
          net: sql<string>`coalesce(sum(case when ${sysMemberBalanceLog.direction} = 'in' then ${sysMemberBalanceLog.amount} else -${sysMemberBalanceLog.amount} end), 0)`
        })
        .from(sysMemberBalanceLog)
        .where(eq(sysMemberBalanceLog.isDeleted, 0))
        .groupBy(sysMemberBalanceLog.userId, sysMemberBalanceLog.account)
    },

    /** 汇总：按业务类型统计区间内的发生额（对账页/看板） */
    async sumByBizType(input: { createdFrom?: string | null; createdTo?: string | null }) {
      const conditions = [eq(sysMemberBalanceLog.isDeleted, 0)]

      if (input.createdFrom) {
        conditions.push(gte(sysMemberBalanceLog.createdAt, input.createdFrom))
      }
      if (input.createdTo) {
        conditions.push(lte(sysMemberBalanceLog.createdAt, input.createdTo))
      }

      return await db
        .select({
          bizType: sysMemberBalanceLog.bizType,
          direction: sysMemberBalanceLog.direction,
          total: sql<string>`coalesce(sum(${sysMemberBalanceLog.amount}), 0)`
        })
        .from(sysMemberBalanceLog)
        .where(and(...conditions))
        .groupBy(sysMemberBalanceLog.bizType, sysMemberBalanceLog.direction)
    },

    /** 最近一条流水（给「最近变动」展示用） */
    async findLatestByUser(userId: string) {
      const rows = await db
        .select()
        .from(sysMemberBalanceLog)
        .where(and(eq(sysMemberBalanceLog.userId, userId), eq(sysMemberBalanceLog.isDeleted, 0)))
        .orderBy(desc(sysMemberBalanceLog.createdAt))
        .limit(1)

      return rows[0] ?? null
    }
  }
}

export type BalanceLogRepo = ReturnType<typeof balanceLogRepo>
