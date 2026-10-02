import type { MySql2Database } from 'drizzle-orm/mysql2'
import type * as schema from '#server/drizzle/schema'
import { sysJobRunnerRepo } from './repo/sysJobRunnerRepo'

/** 日志清理任务保留天数 */
const LOG_RETENTION_DAYS = 30

export type SysJobRunContext = {
  db: MySql2Database<typeof schema>
  jobId: string
  jobCode: string
  triggerType: 'schedule' | 'manual'
}

export type SysJobHandler = {
  code: string
  name: string
  description: string
  run: (ctx: SysJobRunContext) => Promise<unknown>
}

const cleanLogHandler: SysJobHandler = {
  code: 'system:clean-log',
  name: 'Clean system logs',
  description: 'Soft delete system and job logs older than 30 days.',
  async run({ db }) {
    // 原生 SQL 全部收在 mapper（repo/sysJobRunnerRepo），handler 只负责编排与汇总结果
    const repo = sysJobRunnerRepo(db)
    const [systemLogAffectedRows, jobLogAffectedRows] = await Promise.all([
      repo.softDeleteSystemLogsOlderThan(LOG_RETENTION_DAYS),
      repo.softDeleteJobLogsOlderThan(LOG_RETENTION_DAYS)
    ])

    return { systemLogAffectedRows, jobLogAffectedRows }
  }
}

const resetDemoDataHandler: SysJobHandler = {
  code: 'system:reset-demo-data',
  name: 'Reset demo data',
  description: 'Reserved demo reset task. Extend this handler when the reset policy is confirmed.',
  async run({ jobCode, triggerType }) {
    return {
      jobCode,
      triggerType,
      message: 'Reset demo data handler is reserved and did not mutate data.'
    }
  }
}

const handlers = [
  cleanLogHandler,
  resetDemoDataHandler,
] as const

const handlerMap = new Map(handlers.map(handler => [handler.code, handler]))

export function listSysJobHandlers() {
  return handlers.map(({ code, name, description }) => ({ code, name, description }))
}

export function getSysJobHandler(code: string) {
  return handlerMap.get(code)
}

export function hasSysJobHandler(code: string) {
  return handlerMap.has(code)
}
