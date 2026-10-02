/**
 * 支付回调日志 mapper（数据访问层）。
 *
 * 说明：
 * - 只提供「写入一条日志」与「按幂等键判断是否已处理」，去重结论由领域层解释；
 * - 写入抛出的唯一键冲突（ER_DUP_ENTRY）由调用方捕获，用于识别并发回调。
 */
import { eq } from 'drizzle-orm'
import { sysPayNotifyLog } from '#server/drizzle/schema'
import { asDb, type AppExecutor } from '#server/drizzle/db'

export type PayNotifyLogInsert = typeof sysPayNotifyLog.$inferInsert
export type PayNotifyLogRow = typeof sysPayNotifyLog.$inferSelect

export function payNotifyLogRepo(executor: AppExecutor) {
  const db = asDb(executor)

  return {
    async insert(values: PayNotifyLogInsert) {
      return await db.insert(sysPayNotifyLog).values(values)
    },

    /** 幂等键是否已存在（同一平台事件是否处理过） */
    async existsByDedupKey(dedupKey: string): Promise<boolean> {
      const rows = await db
        .select({ id: sysPayNotifyLog.id })
        .from(sysPayNotifyLog)
        .where(eq(sysPayNotifyLog.dedupKey, dedupKey))
        .limit(1)

      return Boolean(rows[0])
    }
  }
}

export type PayNotifyLogRepo = ReturnType<typeof payNotifyLogRepo>
