import type { MySql2Database } from 'drizzle-orm/mysql2'
import type * as schema from '#admin/server/drizzle/schema'
import type { SysJobHandler } from '#admin/server/sys-router/job/handlers'
import { memberService } from '#trade/server/trade-router/domain/member/MemberService'
import { orderService } from '#trade/server/trade-router/domain/order/OrderService'
import { walletService } from '#trade/server/trade-router/domain/wallet/WalletService'
import { rechargeService } from '#trade/server/trade-router/domain/wallet/RechargeService'

/** 单次补充会员档案的上限，避免一次任务扫太多用户 */
const BACKFILL_BATCH_SIZE = 200

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

/**
 * 超时未支付订单自动关闭：释放冻结余额、释放优惠码、回滚库存，订单置为 CL。
 * 余额单的冻结不设过期（`ttlMinutes = 0`），因此这是它们唯一的自动释放触发点。
 *
 * 关单前会先看本地支付单：已是 `OD` 的（回调到了但业务后置没做完、或订单被主动查询推进过）
 * 会被补做业务后置而不是关闭，返回结果里的 `recoveredCount` 就是这类单的数量。
 */
const orderExpireCloseHandler: SysJobHandler = {
    code: 'order:expire-close',
    name: 'Close expired orders',
    description: 'Close unpaid trade orders whose payment window has expired.',
    async run({ db }) {
        return await orderService(db).expireClose()
    }
}

/**
 * 会员等级到期降级：
 * 扫描 `sys_member.status = 1 AND expire_at IS NOT NULL AND expire_at <= now` 的档案，
 * 把等级回落到**默认等级**，同时 `expire_at = NULL`、`level_source = 'auto_expire'`。
 *
 * 逐条独立事务、单条失败不影响其余（与 `order:expire-close` 同形态）。
 */
const memberExpireLevelHandler: SysJobHandler = {
    code: 'member:expire-level',
    name: 'Expire member levels',
    description: 'Downgrade members whose level period has expired back to the default level.',
    async run({ db }) {
        return await memberService(db).expireLevels()
    }
}

/** 电商域任务处理器，由 server/plugins/admin-trade.ts 在启动时注册进基座 */
export const tradeJobHandlers: readonly SysJobHandler[] = [
    memberExpireFreezeHandler,
    memberExpireGiftHandler,
    memberBackfillProfileHandler,
    memberReconcileHandler,
    memberExpireLevelHandler,
    orderExpireCloseHandler
]

// 让类型出现在本文件的类型上下文中（MySql2Database / schema 由 SysJobHandler 间接使用）
export type TradeJobDb = MySql2Database<typeof schema>
