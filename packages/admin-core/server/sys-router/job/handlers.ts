import type { MySql2Database } from 'drizzle-orm/mysql2'
import type * as schema from '#admin/server/drizzle/schema'
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

/**
 * 基座自带的任务处理器。
 *
 * 这里只放**系统域**的任务（日志清理、演示数据重置）。业务域任务
 * （会员过期、订单关闭、对账等）由可选的业务层在启动时通过
 * {@link registerSysJobHandlers} 注册进来，基座无需感知其存在。
 */
const handlers: SysJobHandler[] = [
  cleanLogHandler,
  resetDemoDataHandler
]

const handlerMap = new Map<string, SysJobHandler>(handlers.map(handler => [handler.code, handler]))

/**
 * 注册额外的任务处理器（供可选业务层在 Nitro 插件里调用）。
 *
 * 同名 code 会被覆盖，便于业务层替换基座的默认实现。
 */
export function registerSysJobHandlers(extra: readonly SysJobHandler[]) {
  for (const handler of extra) {
    if (!handlerMap.has(handler.code)) {
      handlers.push(handler)
    } else {
      const index = handlers.findIndex(item => item.code === handler.code)
      if (index >= 0) {
        handlers[index] = handler
      }
    }

    handlerMap.set(handler.code, handler)
  }
}

export function listSysJobHandlers() {
  return handlers.map(({ code, name, description }) => ({ code, name, description }))
}

export function getSysJobHandler(code: string) {
  return handlerMap.get(code)
}

export function hasSysJobHandler(code: string) {
  return handlerMap.has(code)
}
