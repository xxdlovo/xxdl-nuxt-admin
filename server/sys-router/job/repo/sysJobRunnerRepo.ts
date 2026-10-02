/**
 * 任务子系统的 mapper（非请求上下文版本）。
 *
 * 为什么单独一份：SysJobRunner / server/tasks 里的任务没有 tRPC Context，
 * 只能拿到 `useDb()` 的实例，因此这里的入参是 db 而不是 ctx；
 * 所有 select / insert / update / 原生 SQL 都收在本文件，Runner 与 handler 只做编排。
 */
import { eq, sql } from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import type * as schema from '#server/drizzle/schema'
import { sysJob, sysJobLog } from '#server/drizzle/schema'

type JobDb = MySql2Database<typeof schema>

export type SysJobLogInsert = typeof sysJobLog.$inferInsert
export type SysJobLogUpdate = Partial<SysJobLogInsert>
export type SysJobUpdate = Partial<typeof sysJob.$inferInsert>

function affectedRows(result: unknown) {
  const first = Array.isArray(result) ? result[0] : result
  return Number((first as { affectedRows?: number } | undefined)?.affectedRows ?? 0)
}

export function sysJobRunnerRepo(db: JobDb) {
  return {
    async findJobById(jobId: string) {
      const rows = await db
        .select()
        .from(sysJob)
        .where(eq(sysJob.id, jobId))
        .limit(1)

      return rows[0] ?? null
    },

    async insertJobLog(values: SysJobLogInsert) {
      return await db.insert(sysJobLog).values(values)
    },

    async updateJobLogById(logId: string, values: SysJobLogUpdate) {
      return await db.update(sysJobLog).set(values).where(eq(sysJobLog.id, logId))
    },

    async updateJobById(jobId: string, values: SysJobUpdate) {
      return await db.update(sysJob).set(values).where(eq(sysJob.id, jobId))
    },

    /** 软删除 N 天前的系统日志，返回受影响行数 */
    async softDeleteSystemLogsOlderThan(days: number) {
      const result: unknown = await db.execute(sql`
        update sys_system_log
        set is_deleted = 1
        where is_deleted = 0 and created_at < date_sub(now(), interval ${days} day)
      `)

      return affectedRows(result)
    },

    /** 软删除 N 天前的任务日志，返回受影响行数 */
    async softDeleteJobLogsOlderThan(days: number) {
      const result: unknown = await db.execute(sql`
        update sys_job_log
        set is_deleted = 1
        where is_deleted = 0 and created_at < date_sub(now(), interval ${days} day)
      `)

      return affectedRows(result)
    }
  }
}

export type SysJobRunnerRepo = ReturnType<typeof sysJobRunnerRepo>
