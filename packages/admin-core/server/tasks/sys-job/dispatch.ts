import { useDb } from '#admin/server/drizzle/db'
import { and, eq, lte } from 'drizzle-orm'
import { sysJob } from '#admin/server/drizzle/schema'
import { formatMysqlDate, nextRunAt } from '#admin/server/sys-router/job/cron'

export default defineTask({
  meta: {
    name: 'sys-job:dispatch',
    description: 'Dispatch due enabled system jobs.'
  },
  async run() {
      console.log('task refresh run...')
    const db = useDb()
    const jobs = await db
      .select()
      .from(sysJob)
      .where(and(
        eq(sysJob.isDeleted, 0),
        eq(sysJob.status, 1),
        eq(sysJob.runningStatus, 0),
        lte(sysJob.nextRunAt, formatMysqlDate())
      ))
      .orderBy(sysJob.nextRunAt)
    const results = []

    for (const job of jobs) {
      try {
        const dueAt = job.nextRunAt ? new Date(job.nextRunAt).getTime() : 0
        const overdue = Date.now() - dueAt

        // 放弃执行：错过超过 60 秒的任务不补跑，直接把下一次执行时间推到未来。
        if (overdue > 60_000 && job.misfirePolicy === 3) {
          await db.update(sysJob)
            .set({ nextRunAt: formatMysqlDate(nextRunAt(job.cronExpression)) })
            .where(eq(sysJob.id, job.id))
          results.push({
            result: {
              jobId: job.id,
              status: 'skipped',
              reason: 'misfire'
            }
          })
          continue
        }

        results.push(await runTask('sys-job:run', {
          payload: { jobId: job.id, triggerType: 'schedule' }
        }))
      } catch (error) {
        results.push({
          result: {
            jobId: job.id,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error)
          }
        })
      }
    }

    return { result: { dispatched: jobs.length, results } }
  }
})
