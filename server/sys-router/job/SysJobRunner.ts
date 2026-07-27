import { eq } from 'drizzle-orm'
import { useDb } from '#server/drizzle/db'
import { sysJob, sysJobLog } from '#server/drizzle/schema'
import { AppError } from '#server/utils/appError'
import { randomUuid } from '#shared/utils/uuid'
import { formatMysqlDate, nextRunAt } from './cron'
import { getSysJobHandler } from './handlers'

export type SysJobTriggerType = 'schedule' | 'manual'

type RunJobOptions = {
  jobId: string
  triggerType: SysJobTriggerType
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function errorStack(error: unknown) {
  return error instanceof Error ? error.stack : undefined
}

export async function runSysJob({ jobId, triggerType }: RunJobOptions) {
  const db = useDb()
  const jobs = await db
    .select()
    .from(sysJob)
    .where(eq(sysJob.id, jobId))
    .limit(1)

  const job = jobs[0]
  if (!job || job.isDeleted === 1) {
    throw new AppError('common.notExist')
  }

  const handler = getSysJobHandler(job.handlerCode)
  if (!handler) {
    throw new AppError('module.system.job.handlerMissing')
  }

  if (triggerType === 'schedule' && job.status !== 1) {
    return { skipped: true, reason: 'disabled' }
  }

  const started = new Date()
  const startedAt = formatMysqlDate(started)
  const logId = randomUuid()

  await db.insert(sysJobLog).values({
    id: logId,
    jobId: job.id,
    jobName: job.jobName,
    jobCode: job.jobCode,
    handlerCode: job.handlerCode,
    cronExpression: job.cronExpression,
    triggerType,
    status: 0,
    startedAt,
    createdBy: null,
    updatedBy: null,
    isDeleted: 0
  })

  await db.update(sysJob)
    .set({
      runningStatus: 1,
      lastRunAt: startedAt,
      updatedBy: null
    })
    .where(eq(sysJob.id, job.id))

  try {
    const result = await handler.run({
      db,
      jobId: job.id,
      jobCode: job.jobCode,
      triggerType
    })
    const finished = new Date()
    const finishedAt = formatMysqlDate(finished)
    const durationMs = finished.getTime() - started.getTime()
    const nextRun = job.status === 1 ? formatMysqlDate(nextRunAt(job.cronExpression, finished)) : null

    await db.update(sysJobLog)
      .set({
        status: 1,
        finishedAt,
        durationMs,
        result,
        updatedBy: null
      })
      .where(eq(sysJobLog.id, logId))

    await db.update(sysJob)
      .set({
        runningStatus: 0,
        lastSuccessAt: finishedAt,
        lastDurationMs: durationMs,
        lastError: null,
        nextRunAt: nextRun,
        updatedBy: null
      })
      .where(eq(sysJob.id, job.id))

    return { logId, status: 'success', result }
  } catch (error) {
    const finished = new Date()
    const finishedAt = formatMysqlDate(finished)
    const durationMs = finished.getTime() - started.getTime()
    const nextRun = job.status === 1 ? formatMysqlDate(nextRunAt(job.cronExpression, finished)) : null
    const message = errorMessage(error)

    await db.update(sysJobLog)
      .set({
        status: 2,
        finishedAt,
        durationMs,
        errorMessage: message,
        errorStack: errorStack(error),
        updatedBy: null
      })
      .where(eq(sysJobLog.id, logId))

    await db.update(sysJob)
      .set({
        runningStatus: 0,
        lastFailAt: finishedAt,
        lastDurationMs: durationMs,
        lastError: message,
        nextRunAt: nextRun,
        updatedBy: null
      })
      .where(eq(sysJob.id, job.id))

    throw error
  }
}
