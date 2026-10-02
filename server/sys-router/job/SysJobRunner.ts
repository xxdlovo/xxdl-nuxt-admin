import { useDb } from '#server/drizzle/db'
import { AppError } from '#server/utils/appError'
import { randomUuid } from '#shared/utils/uuid'
import { formatMysqlDate, nextRunAt } from './cron'
import { getSysJobHandler } from './handlers'
import { sysJobRunnerRepo } from './repo/sysJobRunnerRepo'

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

/**
 * 执行一次任务。
 *
 * 该函数同时被 tRPC（手动触发）与 nitro 任务调度（定时触发）调用，
 * 没有 tRPC Context，因此数据访问统一走 repo/sysJobRunnerRepo（db 版 mapper）。
 */
export async function runSysJob({ jobId, triggerType }: RunJobOptions) {
  const db = useDb()
  const repo = sysJobRunnerRepo(db)

  const job = await repo.findJobById(jobId)

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

  await repo.insertJobLog({
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

  await repo.updateJobById(job.id, {
    runningStatus: 1,
    lastRunAt: startedAt,
    updatedBy: null
  })

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

    await repo.updateJobLogById(logId, {
      status: 1,
      finishedAt,
      durationMs,
      result,
      updatedBy: null
    })

    await repo.updateJobById(job.id, {
      runningStatus: 0,
      lastSuccessAt: finishedAt,
      lastDurationMs: durationMs,
      lastError: null,
      nextRunAt: nextRun,
      updatedBy: null
    })

    return { logId, status: 'success', result }
  } catch (error) {
    const finished = new Date()
    const finishedAt = formatMysqlDate(finished)
    const durationMs = finished.getTime() - started.getTime()
    const nextRun = job.status === 1 ? formatMysqlDate(nextRunAt(job.cronExpression, finished)) : null
    const message = errorMessage(error)

    await repo.updateJobLogById(logId, {
      status: 2,
      finishedAt,
      durationMs,
      errorMessage: message,
      errorStack: errorStack(error),
      updatedBy: null
    })

    await repo.updateJobById(job.id, {
      runningStatus: 0,
      lastFailAt: finishedAt,
      lastDurationMs: durationMs,
      lastError: message,
      nextRunAt: nextRun,
      updatedBy: null
    })

    throw error
  }
}
