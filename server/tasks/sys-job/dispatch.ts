import { useDb } from '#server/drizzle/db'
import { and, eq, lte } from 'drizzle-orm'
import { sysJob } from '#server/drizzle/schema'
import { formatMysqlDate } from '#server/sys-router/job/cron'

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
