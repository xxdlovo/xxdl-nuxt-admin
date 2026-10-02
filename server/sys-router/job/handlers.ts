import type { MySql2Database } from 'drizzle-orm/mysql2'
import type * as schema from '#server/drizzle/schema'
import { sysJobRunnerRepo } from './repo/sysJobRunnerRepo'
import { memberService } from '#server/trade-router/domain/member/MemberService'
import { walletService } from '#server/trade-router/domain/wallet/WalletService'
import { rechargeService } from '#server/trade-router/domain/wallet/RechargeService'

/** 日志清理任务保留天数 */
const LOG_RETENTION_DAYS = 30

/** 单次补充会员档案的上限，避免一次任务扫太多用户 */
const BACKFILL_BATCH_SIZE = 200

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
 * 超时冻结单自动释放。
 * 冻结是「预占」状态，业务超时未确认就把钱退回可用余额（幂等，可重复跑）。
 */
const memberExpireFreezeHandler: SysJobHandler = {
  code: 'member:expire-freeze',
  name: 'Expire member freezes',
  description: 'Release member balance freezes whose TTL has passed.',
  async run({ db }) {
    return await walletService(db).expireFreezes()
  }
}

/** 赠送金批次过期扣回：只扣未被冻结的部分，冻结部分等释放或过期后再扣。 */
const memberExpireGiftHandler: SysJobHandler = {
  code: 'member:expire-gift',
  name: 'Expire member gift batches',
  description: 'Deduct expired gift balance batches from member wallets.',
  async run({ db }) {
    return await walletService(db).expireGiftBatches()
  }
}

/**
 * 会员档案补齐：给历史用户（注册/OAuth 建档失败、或功能上线前的老用户）补开档案。
 * 逐条调用领域 `onboard`，幂等；单次限量，多轮执行即可补齐。
 */
const memberBackfillProfileHandler: SysJobHandler = {
  code: 'member:backfill-profile',
  name: 'Backfill member profiles',
  description: 'Create member profiles for users that do not have one yet.',
  async run({ db }) {
    const member = memberService(db)
    const userIds = await member.listUnprofiledUsers(BACKFILL_BATCH_SIZE)

    let createdCount = 0
    let skippedCount = 0
    const failures: Array<{ userId: string, message: string }> = []

    for (const userId of userIds) {
      try {
        const result = await member.onboard({ userId, source: 'backfill', operatorId: null })

        if (result.created) {
          createdCount += 1
        } else {
          skippedCount += 1
        }
      } catch (error) {
        failures.push({
          userId,
          message: error instanceof Error ? error.message : 'unknown error'
        })
      }
    }

    return {
      scanned: userIds.length,
      createdCount,
      skippedCount,
      failureCount: failures.length,
      failures: failures.slice(0, 20)
    }
  }
}

/**
 * 每日对账：
 * 1. 余额一致性校验（钱包余额 vs 流水净额）；
 * 2. 未到账充值补偿（支付单已支付但充值单未到账，多为回调丢失）。
 * 只做校验与补偿，差异明细只回报不自动改余额。
 */
const memberReconcileHandler: SysJobHandler = {
  code: 'member:reconcile',
  name: 'Reconcile member wallets',
  description: 'Verify wallet balances against the ledger and recover missed recharge credits.',
  async run({ db }) {
    const [consistency, recovered] = await Promise.all([
      walletService(db).assertConsistency({ userId: null }),
      rechargeService(db).retryPending(200, null)
    ])

    const recoveredCount = recovered.results.filter(item => item.ok).length
    const failedCount = recovered.results.length - recoveredCount

    return {
      checkedUsers: consistency.checkedUsers,
      mismatchCount: consistency.mismatches.length,
      mismatches: consistency.mismatches.slice(0, 20),
      pendingRechargeScanned: recovered.scanned,
      recoveredCount,
      failedCount
    }
  }
}

const handlers = [
  cleanLogHandler,
  resetDemoDataHandler,
  memberExpireFreezeHandler,
  memberExpireGiftHandler,
  memberBackfillProfileHandler,
  memberReconcileHandler,
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
