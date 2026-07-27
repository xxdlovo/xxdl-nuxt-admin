import { sql } from 'drizzle-orm'
import type { MySql2Database } from 'drizzle-orm/mysql2'
import type * as schema from '#server/drizzle/schema'

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
    const [systemLogResult, jobLogResult] = await Promise.all([
      db.execute(sql`update sys_system_log set is_deleted = 1 where is_deleted = 0 and created_at < date_sub(now(), interval 30 day)`),
      db.execute(sql`update sys_job_log set is_deleted = 1 where is_deleted = 0 and created_at < date_sub(now(), interval 30 day)`)
    ])

    return {
      systemLogAffectedRows: Number((systemLogResult[0] as { affectedRows?: number })?.affectedRows ?? 0),
      jobLogAffectedRows: Number((jobLogResult[0] as { affectedRows?: number })?.affectedRows ?? 0)
    }
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
