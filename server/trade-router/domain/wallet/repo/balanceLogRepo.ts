/**
 * 余额流水 mapper（数据访问层）。
 *
 * 流水表是**只增不改**的资金凭证：
 * - `insert` 依赖 `uk_member_log_dedup` 唯一索引做幂等，重复事件会抛 ER_DUP_ENTRY，
 *   由领域层捕获并解释为「已入账」；
 * - 汇总查询用于对账（按账户汇总净额）与财务看板。
 */
import { and, count, desc, eq, gte, like, lte, sql } from 'drizzle-orm'
import { sysMemberBalanceLog } from '#server/drizzle/schema'
import { asDb, type AppExecutor } from '#server/drizzle/db'

export type BalanceLogRow = typeof sysMemberBalanceLog.$inferSelect
export type BalanceLogInsert = typeof sysMemberBalanceLog.$inferInsert

/** 流水筛选条件（后台列表、自助查询与导出共用） */
export type BalanceLogFilters = {
  userId?: string | null
  account?: string | null
  direction?: string | null
  bizType?: string | null
  bizNo?: string | null
  createdFrom?: string | null
  createdTo?: string | null
}

/** 组装筛选条件（导出为独立函数，避免 Repo 返回类型自引用导致 TS 循环推导） */
function buildBalanceLogConditions(filters: BalanceLogFilters) {
  const conditions = [eq(sysMemberBalanceLog.isDeleted, 0)]

  if (filters.userId) {
    conditions.push(eq(sysMemberBalanceLog.userId, filters.userId))
  }
  if (filters.account) {
    conditions.push(eq(sysMemberBalanceLog.account, filters.account))
  }
  if (filters.direction) {
    conditions.push(eq(sysMemberBalanceLog.direction, filters.direction))
  }
  if (filters.bizType) {
    conditions.push(eq(sysMemberBalanceLog.bizType, filters.bizType))
  }
  if (filters.bizNo) {
    conditions.push(like(sysMemberBalanceLog.bizNo, `%${filters.bizNo}%`))
  }
  if (filters.createdFrom) {
    conditions.push(gte(sysMemberBalanceLog.createdAt, filters.createdFrom))
  }
  if (filters.createdTo) {
    conditions.push(lte(sysMemberBalanceLog.createdAt, filters.createdTo))
  }

  return conditions
}

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
    },

    /** 组合筛选条件（后台流水列表与自助查询共用） */
    buildConditions(filters: BalanceLogFilters) {
      return buildBalanceLogConditions(filters)
    },

    /** 分页查询（时间倒序） */
    async pageByFilters(filters: BalanceLogFilters, page: number, pageSize: number) {
      const conditions = buildBalanceLogConditions(filters)

      const totalRows = await db
        .select({ total: count() })
        .from(sysMemberBalanceLog)
        .where(and(...conditions))

      const list = await db
        .select()
        .from(sysMemberBalanceLog)
        .where(and(...conditions))
        .orderBy(desc(sysMemberBalanceLog.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize)

      return { total: Number(totalRows[0]?.total ?? 0), page, pageSize, list }
    },

    /** 导出用：按条件取一页（上限由调用方控制） */
    async listByFilters(filters: BalanceLogFilters, limit: number) {
      const conditions = buildBalanceLogConditions(filters)

      return await db
        .select()
        .from(sysMemberBalanceLog)
        .where(and(...conditions))
        .orderBy(desc(sysMemberBalanceLog.createdAt))
        .limit(limit)
    }
  }
}

export type BalanceLogRepo = ReturnType<typeof balanceLogRepo>
