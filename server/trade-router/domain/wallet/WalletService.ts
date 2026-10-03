/**
 * 余额领域服务（资金唯一入口）。
 *
 * 三条硬规则：
 * 1. **所有余额变更都在事务里**：`walletService(db)` 的写方法内部 `db.transaction(...)`；
 *    已经处于事务中的调用方（例如支付回调要「改订单 + 入账」一起提交）改用
 *    `walletServiceIn(tx)`，由调用方自己保证事务边界。
 * 2. **幂等靠唯一索引**：流水 `dedup_key`、冻结单 `biz_no`、赠送批次 `biz_no`、充值单
 *    `out_trade_no`。命中唯一键冲突时抛 `AlreadyAppliedError`，事务整体回滚（不会重复加钱），
 *    外层捕获后返回「已处理（reused: true）」的结果。
 * 3. **余额不会被扣成负数**：余额变更都是带守卫的条件更新，`affectedRows === 0` 即余额不足。
 *
 * 流水只记真实余额变动；预扣/释放属预扣状态，记录在 `sys_member_freeze`，
 * 因此 `余额 = Σ(in) − Σ(out)` 恒成立（对账见 `assertConsistency`）。
 */
import { AppError } from '#server/utils/appError'
import { asDb, type AppDb, type AppExecutor, type AppTx } from '#server/drizzle/db'
import { randomUuid } from '#shared/utils/uuid'
import { balanceLogRepo } from './repo/balanceLogRepo'
import { freezeRepo, type FreezeRow } from './repo/freezeRepo'
import { giftGrantRepo } from './repo/giftGrantRepo'
import { isDuplicateKeyError } from './repo/sqlUtils'
import { rechargeRepo } from './repo/rechargeRepo'
import { walletRepo, type WalletRow } from './repo/walletRepo'
import type {
  FreezeResult,
  FreezeSettleResult,
  ReconcileMismatch,
  WalletAccount,
  WalletSnapshot
} from './types'
import {
  addMoney,
  buildDedupKey,
  compareMoney,
  isPositiveMoney,
  isZeroMoney,
  normalizeMoney,
  subMoney
} from './utils'
import { nowForMysql } from '../pay/utils'

/** 默认冻结有效期（分钟）：避免业务忘记释放导致余额被长期占住 */
const DEFAULT_FREEZE_TTL_MINUTES = 30

/**
 * 业务单号长度上限：`sys_member_balance_log` / `sys_member_gift_grant` /
 * `sys_member_freeze` / `sys_member_coupon_use` 的 `biz_no` 都是 varchar(64)。
 * 超长时给业务错误而不是让 MySQL 抛 `Data too long`（后者对使用者毫无提示价值）。
 */
const BIZ_NO_MAX_LENGTH = 64

/** 手工调账的业务单号：只由 requestId 组成（操作人已单独落在 operator_id 列，无需进业务键） */
export function buildAdjustBizNo(requestId: string): string {
  return `adjust:${requestId}`
}

/** 手工发放赠送金的业务单号：同样只由 requestId 组成 */
export function buildGiftGrantBizNo(requestId: string): string {
  return `gift:${requestId}`
}

function assertBizNoLength(bizNo: string, label: string) {
  if (bizNo.length > BIZ_NO_MAX_LENGTH) {
    throw new AppError('module.system.member.bizNoTooLong', {
      message: `${label} ${bizNo.length}/${BIZ_NO_MAX_LENGTH}`
    })
  }
}

/** 幂等命中：唯一键冲突说明该业务事件已经被处理过，外层据此回滚并返回「已处理」 */
class AlreadyAppliedError extends Error {
  constructor() {
    super('already applied')
    this.name = 'AlreadyAppliedError'
  }
}

export type WalletOperatorMeta = {
  operatorId?: string | null
}

export type CreditResult = {
  userId: string
  account: WalletAccount
  amount: string
  /** 入账后的账户余额 */
  balance: string
  /** true = 该业务事件此前已入账，本次未重复记账 */
  reused: boolean
  /** 赠送金入账时生成的批次 ID */
  grantId: string | null
}

export type AdjustResult = CreditResult

export type ExpireGiftResult = {
  scanned: number
  expiredCount: number
  expiredAmount: string
}

export type ExpireFreezeResult = {
  scanned: number
  releasedCount: number
  releasedAmount: string
}

export type ConsistencyResult = {
  checkedUsers: number
  mismatches: ReconcileMismatch[]
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

function toSnapshot(row: WalletRow): WalletSnapshot {
  const availableRecharge = subMoney(row.rechargeBalance, row.frozenRecharge)
  const availableGift = subMoney(row.giftBalance, row.frozenGift)

  return {
    id: row.id,
    userId: row.userId,
    currency: row.currency,
    rechargeBalance: row.rechargeBalance,
    giftBalance: row.giftBalance,
    frozenRecharge: row.frozenRecharge,
    frozenGift: row.frozenGift,
    availableRecharge,
    availableGift,
    availableTotal: addMoney(availableRecharge, availableGift),
    totalRecharge: row.totalRecharge,
    totalGift: row.totalGift,
    totalConsume: row.totalConsume,
    status: row.status
  }
}

function emptySnapshot(userId: string): WalletSnapshot {
  return {
    id: '',
    userId,
    currency: 'CNY',
    rechargeBalance: '0.00',
    giftBalance: '0.00',
    frozenRecharge: '0.00',
    frozenGift: '0.00',
    availableRecharge: '0.00',
    availableGift: '0.00',
    availableTotal: '0.00',
    totalRecharge: '0.00',
    totalGift: '0.00',
    totalConsume: '0.00',
    status: null
  }
}

function toFreezeResult(row: FreezeRow, reused: boolean): FreezeResult {
  return {
    freezeId: row.id,
    bizNo: row.bizNo,
    amount: row.amount,
    giftAmount: row.giftAmount,
    rechargeAmount: row.rechargeAmount,
    status: row.status as FreezeResult['status'],
    expireAt: row.expireAt ?? null,
    reused
  }
}

/**
 * 内部实现：绑定到一个执行器（连接或事务）的余额操作集合。
 * 不做事务管理，由 `walletService` / `walletServiceIn` 决定边界。
 */
function buildWallet(executor: AppExecutor) {
  const wallet = walletRepo(executor)
  const grants = giftGrantRepo(executor)
  const logs = balanceLogRepo(executor)
  const freezes = freezeRepo(executor)
  const recharges = rechargeRepo(executor)

  /** 读钱包行；没有则返回 null（读接口不产生副作用） */
  async function findWallet(userId: string) {
    return await wallet.findByUserId(userId)
  }

  /** 确保钱包存在：先查再插，插入撞唯一键说明并发已建好 */
  async function ensureWallet(userId: string, operatorId: string | null) {
    const existing = await wallet.findByUserId(userId)
    if (existing) {
      return existing
    }

    try {
      await wallet.insert({
        id: randomUuid(),
        userId,
        currency: 'CNY',
        status: 1,
        createdBy: operatorId,
        updatedBy: operatorId,
        isDeleted: 0
      })
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error
      }
    }

    const created = await wallet.findByUserId(userId)
    if (!created) {
      throw new AppError('module.system.member.walletInitFailed')
    }

    return created
  }

  async function readBalance(userId: string, account: WalletAccount): Promise<string> {
    const row = await findWallet(userId)
    if (!row) {
      return '0.00'
    }

    return account === 'recharge' ? row.rechargeBalance : row.giftBalance
  }

  async function getWallet(userId: string): Promise<WalletSnapshot> {
    const row = await findWallet(userId)

    return row ? toSnapshot(row) : emptySnapshot(userId)
  }

  /**
   * 写一条流水。
   *
   * 「发生前余额」由「发生后余额 ± 本次金额」反推：同一事务内刚做完条件更新，
   * 读到的就是本次操作后的真实值，因此反推是精确的。
   */
  async function insertLog(input: {
    userId: string
    account: WalletAccount
    direction: 'in' | 'out'
    amount: string
    bizType: Parameters<typeof buildDedupKey>[0]
    bizNo: string
    operatorId: string | null
    reason?: string | null
    remark?: string | null
  }) {
    const after = await readBalance(input.userId, input.account)
    const before = input.direction === 'in'
      ? subMoney(after, input.amount)
      : addMoney(after, input.amount)

    try {
      await logs.insert({
        id: randomUuid(),
        userId: input.userId,
        account: input.account,
        direction: input.direction,
        amount: input.amount,
        balanceBefore: before,
        balanceAfter: after,
        bizType: input.bizType,
        bizNo: input.bizNo,
        dedupKey: buildDedupKey(input.bizType, input.bizNo, input.account),
        operatorId: input.operatorId,
        reason: input.reason ?? null,
        remark: input.remark ?? null,
        createdBy: input.operatorId,
        updatedBy: input.operatorId,
        isDeleted: 0
      })
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        // 同一事件已入账：回滚本次余额变更，由外层返回 reused
        throw new AlreadyAppliedError()
      }
      throw error
    }

    return { before, after }
  }

  /**
   * 按到期时间先扣赠送金批次（FIFO）。
   * 属于「批次台账」维护，失败不阻断资金主流程（钱包余额才是账实依据），
   * 偏差由对账接口暴露。
   */
  async function consumeGiftBatches(userId: string, amount: string, operatorId: string | null) {
    if (!isPositiveMoney(amount)) {
      return
    }

    let remaining = amount
    const batches = await grants.listActiveByUser(userId)

    for (const batch of batches) {
      if (!isPositiveMoney(remaining)) {
        break
      }

      const take = compareMoney(batch.remainAmount, remaining) >= 0 ? remaining : batch.remainAmount
      const affected = await grants.consumeRemain({ grantId: batch.id, amount: take, operatorId })

      if (affected > 0) {
        await grants.markUsedIfEmpty(batch.id, operatorId)
        remaining = subMoney(remaining, take)
      }
    }
  }

  return {
    getWallet,
    findWallet,
    readBalance,

    /** 入账：充值 / 赠送 / 注册赠金 / 调增 */
    async credit(input: {
      userId: string
      account: WalletAccount
      amount: string | number
      bizType: 'recharge' | 'register_bonus' | 'gift_system' | 'gift_campaign' | 'adjust'
      bizNo: string
      giftExpireAt?: string | null
      giftSource?: 'register' | 'system' | 'campaign'
      operatorId?: string | null
      reason?: string | null
      remark?: string | null
    }): Promise<CreditResult> {
      const amount = normalizeMoney(input.amount)
      const operatorId = input.operatorId ?? null
      assertBizNoLength(input.bizNo, 'bizNo')
      const dedupKey = buildDedupKey(input.bizType, input.bizNo, input.account)

      // 快速路径：命中幂等键直接返回，不再进入写链路
      if (await logs.existsByDedupKey(dedupKey)) {
        return {
          userId: input.userId,
          account: input.account,
          amount,
          balance: await readBalance(input.userId, input.account),
          reused: true,
          grantId: null
        }
      }

      await ensureWallet(input.userId, operatorId)

      // 赠送金先建批次：保证「赠送金余额 = 有效批次剩余之和」
      let grantId: string | null = null
      if (input.account === 'gift') {
        grantId = randomUuid()
        try {
          await grants.insert({
            id: grantId,
            userId: input.userId,
            amount,
            remainAmount: amount,
            source: input.giftSource ?? 'system',
            expireAt: input.giftExpireAt ?? null,
            bizNo: input.bizNo,
            status: 'active',
            createdBy: operatorId,
            updatedBy: operatorId,
            isDeleted: 0
          })
        } catch (error) {
          if (isDuplicateKeyError(error)) {
            throw new AlreadyAppliedError()
          }
          throw error
        }
      }

      const affected = await wallet.credit({
        userId: input.userId,
        account: input.account,
        amount,
        operatorId,
        countRechargeTotal: input.bizType === 'recharge',
        countGiftTotal: input.account === 'gift'
      })

      if (affected === 0) {
        throw new AppError('module.system.member.walletNotFound')
      }

      const { after } = await insertLog({
        userId: input.userId,
        account: input.account,
        direction: 'in',
        amount,
        bizType: input.bizType,
        bizNo: input.bizNo,
        operatorId,
        reason: input.reason ?? null,
        remark: input.remark ?? null
      })

      return { userId: input.userId, account: input.account, amount, balance: after, reused: false, grantId }
    },

    /** 手工调账：加 / 减余额，必须带原因与 requestId（防重复提交） */
    async adjust(input: {
      userId: string
      account: WalletAccount
      direction: 'in' | 'out'
      amount: string | number
      operatorId?: string | null
      reason?: string | null
      requestId: string
      remark?: string | null
    }): Promise<AdjustResult> {
      const reason = String(input.reason ?? '').trim()
      if (!reason) {
        throw new AppError('module.system.member.adjustReasonRequired')
      }

      const amount = normalizeMoney(input.amount)
      const operatorId = input.operatorId ?? null
      const bizNo = buildAdjustBizNo(input.requestId)
      assertBizNoLength(bizNo, 'bizNo')
      const dedupKey = buildDedupKey('adjust', bizNo, input.account)

      if (await logs.existsByDedupKey(dedupKey)) {
        return {
          userId: input.userId,
          account: input.account,
          amount,
          balance: await readBalance(input.userId, input.account),
          reused: true,
          grantId: null
        }
      }

      await ensureWallet(input.userId, operatorId)

      if (input.direction === 'in') {
        const affected = await wallet.credit({
          userId: input.userId,
          account: input.account,
          amount,
          operatorId,
          countRechargeTotal: false,
          countGiftTotal: false
        })

        if (affected === 0) {
          throw new AppError('module.system.member.walletNotFound')
        }
      } else {
        const affected = await wallet.decreaseBalance({
          userId: input.userId,
          account: input.account,
          amount,
          operatorId
        })

        if (affected === 0) {
          throw new AppError('module.system.member.balanceInsufficient')
        }
      }

      const { after } = await insertLog({
        userId: input.userId,
        account: input.account,
        direction: input.direction,
        amount,
        bizType: 'adjust',
        bizNo,
        operatorId,
        reason,
        remark: input.remark ?? null
      })

      // 扣减赠送金时同步扣批次台账，保持「赠送金余额 = 批次剩余之和」
      if (input.direction === 'out' && input.account === 'gift') {
        await consumeGiftBatches(input.userId, amount, operatorId)
      }

      return { userId: input.userId, account: input.account, amount, balance: after, reused: false, grantId: null }
    },

    /**
     * 预扣冻结：先赠送金后充值金。
     * 同一 `bizNo` 重复调用返回首次结果（`reused: true`），不会重复占用余额。
     */
    async freeze(input: {
      userId: string
      bizNo: string
      amount: string | number
      subject?: string | null
      attach?: string | null
      ttlMinutes?: number | null
      operatorId?: string | null
    }): Promise<FreezeResult> {
      const amount = normalizeMoney(input.amount)
      const operatorId = input.operatorId ?? null
      assertBizNoLength(input.bizNo, 'bizNo')

      const existing = await freezes.findByBizNo(input.bizNo)
      if (existing) {
        return toFreezeResult(existing, true)
      }

      const walletRow = await ensureWallet(input.userId, operatorId)

      // 拆分：可用赠送金优先，不足部分落充值金
      const availableGift = subMoney(walletRow.giftBalance, walletRow.frozenGift)
      const giftAmount = compareMoney(availableGift, amount) >= 0 ? amount : availableGift
      const rechargeAmount = subMoney(amount, giftAmount)

      const affected = await wallet.freezeFunds({
        userId: input.userId,
        giftAmount,
        rechargeAmount,
        operatorId
      })

      if (affected === 0) {
        throw new AppError('module.system.member.balanceInsufficient')
      }

      const ttl = input.ttlMinutes === null || input.ttlMinutes === undefined
        ? DEFAULT_FREEZE_TTL_MINUTES
        : input.ttlMinutes
      const expireAt = ttl > 0 ? nowForMysql(addMinutes(new Date(), ttl)) : null
      const freezeId = randomUuid()

      try {
        await freezes.insert({
          id: freezeId,
          bizNo: input.bizNo,
          userId: input.userId,
          amount,
          giftAmount,
          rechargeAmount,
          status: 'FROZEN',
          subject: input.subject ?? null,
          attach: input.attach ?? null,
          expireAt,
          createdBy: operatorId,
          updatedBy: operatorId,
          isDeleted: 0
        })
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          throw new AlreadyAppliedError()
        }
        throw error
      }

      const stored = await freezes.findByBizNo(input.bizNo)

      return stored
        ? toFreezeResult(stored, false)
        : {
            freezeId,
            bizNo: input.bizNo,
            amount,
            giftAmount,
            rechargeAmount,
            status: 'FROZEN',
            expireAt,
            reused: false
          }
    },

    /** 确认实扣：扣余额 + 扣赠送金批次 + 累计消费；只有冻结中的单子能确认 */
    async confirm(input: { freezeId?: string | null; bizNo?: string | null; operatorId?: string | null }): Promise<FreezeSettleResult> {
      const operatorId = input.operatorId ?? null
      const row = input.freezeId
        ? await freezes.findById(input.freezeId)
        : input.bizNo ? await freezes.findByBizNo(input.bizNo) : null

      if (!row) {
        throw new AppError('module.system.member.freezeNotFound')
      }

      if (row.status === 'CONFIRMED') {
        return { freezeId: row.id, bizNo: row.bizNo, status: 'CONFIRMED', giftAmount: row.giftAmount, rechargeAmount: row.rechargeAmount, reused: true }
      }

      if (row.status !== 'FROZEN') {
        throw new AppError('module.system.member.freezeNotFrozen')
      }

      const now = nowForMysql()
      const affected = await freezes.markConfirmed({ id: row.id, now, operatorId })

      if (affected === 0) {
        // 并发下已被其他请求处理：重新读取后按已有状态返回
        const latest = await freezes.findById(row.id)
        if (latest?.status === 'CONFIRMED') {
          return { freezeId: row.id, bizNo: row.bizNo, status: 'CONFIRMED', giftAmount: row.giftAmount, rechargeAmount: row.rechargeAmount, reused: true }
        }
        throw new AppError('module.system.member.freezeNotFrozen')
      }

      const settled = await wallet.settleFrozen({
        userId: row.userId,
        giftAmount: row.giftAmount,
        rechargeAmount: row.rechargeAmount,
        operatorId
      })

      if (settled === 0) {
        throw new AppError('module.system.member.walletInconsistent')
      }

      if (isPositiveMoney(row.giftAmount)) {
        await insertLog({
          userId: row.userId,
          account: 'gift',
          direction: 'out',
          amount: row.giftAmount,
          bizType: 'consume_confirm',
          bizNo: row.bizNo,
          operatorId,
          remark: row.subject ?? null
        })
        await consumeGiftBatches(row.userId, row.giftAmount, operatorId)
      }

      if (isPositiveMoney(row.rechargeAmount)) {
        await insertLog({
          userId: row.userId,
          account: 'recharge',
          direction: 'out',
          amount: row.rechargeAmount,
          bizType: 'consume_confirm',
          bizNo: row.bizNo,
          operatorId,
          remark: row.subject ?? null
        })
      }

      return {
        freezeId: row.id,
        bizNo: row.bizNo,
        status: 'CONFIRMED',
        giftAmount: row.giftAmount,
        rechargeAmount: row.rechargeAmount,
        reused: false
      }
    },

    /** 释放冻结（业务失败 / 人工释放）：只清冻结，不动余额 */
    async release(input: {
      freezeId?: string | null
      bizNo?: string | null
      reason?: string | null
      operatorId?: string | null
    }): Promise<FreezeSettleResult> {
      const operatorId = input.operatorId ?? null
      const row = input.freezeId
        ? await freezes.findById(input.freezeId)
        : input.bizNo ? await freezes.findByBizNo(input.bizNo) : null

      if (!row) {
        throw new AppError('module.system.member.freezeNotFound')
      }

      if (row.status === 'RELEASED' || row.status === 'EXPIRED') {
        return { freezeId: row.id, bizNo: row.bizNo, status: row.status as FreezeSettleResult['status'], giftAmount: row.giftAmount, rechargeAmount: row.rechargeAmount, reused: true }
      }

      if (row.status !== 'FROZEN') {
        throw new AppError('module.system.member.freezeNotFrozen')
      }

      const now = nowForMysql()
      const affected = await freezes.markReleased({
        id: row.id,
        now,
        reason: input.reason ?? null,
        status: 'RELEASED',
        operatorId
      })

      if (affected === 0) {
        const latest = await freezes.findById(row.id)
        if (latest && (latest.status === 'RELEASED' || latest.status === 'EXPIRED')) {
          return { freezeId: row.id, bizNo: row.bizNo, status: latest.status as FreezeSettleResult['status'], giftAmount: row.giftAmount, rechargeAmount: row.rechargeAmount, reused: true }
        }
        throw new AppError('module.system.member.freezeNotFrozen')
      }

      const released = await wallet.releaseFunds({
        userId: row.userId,
        giftAmount: row.giftAmount,
        rechargeAmount: row.rechargeAmount,
        operatorId
      })

      if (released === 0) {
        throw new AppError('module.system.member.walletInconsistent')
      }

      return {
        freezeId: row.id,
        bizNo: row.bizNo,
        status: 'RELEASED',
        giftAmount: row.giftAmount,
        rechargeAmount: row.rechargeAmount,
        reused: false
      }
    },

    /**
     * 赠送金过期：把过期批次的剩余额度扣掉，并同步扣减钱包赠送金余额。
     *
     * 关键约束：**只过期「可用」的那部分**（`gift_balance - frozen_gift`）。
     * 若某批次的一部分正被冻结占用，本次只处理可用额度，批次保持 active、剩余额度留着，
     * 待冻结结算后的下一轮再处理。这样不会把可用余额扣成负数，也不会让冻结单确认时失败。
     */
    async expireGiftBatches(executorLimit = 200): Promise<ExpireGiftResult> {
      const now = nowForMysql()
      const batches = await grants.listExpiredActive(now, executorLimit)
      const availableCache = new Map<string, string>()
      let expiredCount = 0
      let expiredAmount = '0.00'

      for (const batch of batches) {
        let available = availableCache.get(batch.userId)

        if (available === undefined) {
          const row = await findWallet(batch.userId)
          available = row ? subMoney(row.giftBalance, row.frozenGift) : '0.00'
          availableCache.set(batch.userId, available)
        }

        if (!isPositiveMoney(available) || !isPositiveMoney(batch.remainAmount)) {
          continue
        }

        const expireAmount = compareMoney(batch.remainAmount, available) >= 0 ? available : batch.remainAmount

        if (isZeroMoney(expireAmount)) {
          continue
        }

        // 先扣批次台账：台账没扣成功就不动钱包余额，避免出现「余额减了、批次还在」
        const consumed = await grants.consumeRemain({ grantId: batch.id, amount: expireAmount, operatorId: null })

        if (consumed === 0) {
          continue
        }

        const decremented = await wallet.decreaseBalance({
          userId: batch.userId,
          account: 'gift',
          amount: expireAmount,
          operatorId: null
        })

        if (decremented === 0) {
          // 余额不足（并发消费/人工调账造成）：整体回滚，等下一轮再处理
          throw new AppError('module.system.member.walletInconsistent')
        }

        try {
          await insertLog({
            userId: batch.userId,
            account: 'gift',
            direction: 'out',
            amount: expireAmount,
            // 幂等键带上金额：同一批次被分批过期时不会互相顶掉
            bizNo: `gift_expire:${batch.id}:${expireAmount}`,
            bizType: 'gift_expire',
            operatorId: null,
            reason: `批次 ${batch.id} 过期`
          })
        } catch (error) {
          if (!(error instanceof AlreadyAppliedError)) {
            throw error
          }
        }

        /**
         * 批次剩余为 0 说明整批（或剩余部分）已经过期掉：置 `expired`。
         *
         * **顺序很关键**：`markExpired` 的守卫是 `status = 'active'`，而 `markUsedIfEmpty`
         * 会在剩余为 0 时把状态改成 `used`；先调后者的话前者就永远影响 0 行，
         * 批次会停在 `used`，`expired` 这个语义状态实际写不出来。
         * 剩余仍大于 0 时保持 `active`，交给下一轮任务继续处理（部分过期是允许的）。
         */
        const latestBatch = await grants.findByBizNo(batch.bizNo)

        if (latestBatch && !isPositiveMoney(latestBatch.remainAmount)) {
          await grants.markExpired(batch.id, null)
        }

        availableCache.set(batch.userId, subMoney(available, expireAmount))
        expiredCount += 1
        expiredAmount = addMoney(expiredAmount, expireAmount)
      }

      return { scanned: batches.length, expiredCount, expiredAmount }
    },

    /** 冻结超时释放（业务失败/进程中断的兜底） */
    async expireFreezes(scanLimit = 200): Promise<ExpireFreezeResult> {
      const now = nowForMysql()
      const rows = await freezes.listExpiredFrozen(now, scanLimit)
      let releasedCount = 0
      let releasedAmount = '0.00'

      for (const row of rows) {
        const affected = await freezes.markReleased({
          id: row.id,
          now,
          reason: '冻结超时自动释放',
          status: 'EXPIRED',
          operatorId: null
        })

        if (affected === 0) {
          continue
        }

        const released = await wallet.releaseFunds({
          userId: row.userId,
          giftAmount: row.giftAmount,
          rechargeAmount: row.rechargeAmount,
          operatorId: null
        })

        if (released === 0) {
          // 冻结额与钱包不一致：整体回滚，保持 FROZEN 等人工/对账处理
          throw new AppError('module.system.member.walletInconsistent')
        }

        releasedCount += 1
        releasedAmount = addMoney(releasedAmount, row.amount)
      }

      return { scanned: rows.length, releasedCount, releasedAmount }
    },

    /**
     * 对账：钱包余额 vs 流水净额。
     * 公式 `recharge_balance = Σ(in) − Σ(out)`（按账户分别核对），
     * 不传 userId 时校验全部用户（一次分组查询完成）。
     */
    async assertConsistency(input: { userId?: string | null } = {}): Promise<ConsistencyResult> {
      const mismatches: ReconcileMismatch[] = []

      /**
       * **逐账户**核对：两个账户各自必须与流水净额相等。
       *
       * 早期实现比的是「两账户合计」，会掩盖对冲错误 —— 例如充值金多 100、赠送金少 100，
       * 合计仍然相等，对账看起来是干净的，但单个账户已经错了。
       */
      function pushAccountMismatch(userId: string, account: WalletAccount, walletAmount: string, ledgerAmount: string) {
        if (compareMoney(walletAmount, ledgerAmount) === 0) {
          return
        }

        mismatches.push({
          userId,
          account,
          walletTotal: walletAmount,
          ledgerTotal: ledgerAmount,
          diff: subMoney(walletAmount, ledgerAmount)
        })
      }

      if (input.userId) {
        const walletRow = await findWallet(input.userId)
        const nets = await logs.sumNetByUser(input.userId)
        const netMap = new Map(nets.map(item => [item.account, String(item.net)]))

        pushAccountMismatch(input.userId, 'recharge', walletRow?.rechargeBalance ?? '0.00', netMap.get('recharge') ?? '0.00')
        pushAccountMismatch(input.userId, 'gift', walletRow?.giftBalance ?? '0.00', netMap.get('gift') ?? '0.00')

        return { checkedUsers: 1, mismatches }
      }

      const [walletRows, netRows] = await Promise.all([
        wallet.listAllForReconcile(),
        logs.sumNetGroupByUser()
      ])

      const netMap = new Map<string, { recharge: string; gift: string }>()
      for (const row of netRows) {
        const current = netMap.get(row.userId) ?? { recharge: '0.00', gift: '0.00' }
        if (row.account === 'recharge') {
          current.recharge = String(row.net)
        } else if (row.account === 'gift') {
          current.gift = String(row.net)
        }
        netMap.set(row.userId, current)
      }

      const seen = new Set<string>()

      for (const row of walletRows) {
        seen.add(row.userId)
        const ledger = netMap.get(row.userId) ?? { recharge: '0.00', gift: '0.00' }

        pushAccountMismatch(row.userId, 'recharge', row.rechargeBalance, ledger.recharge)
        pushAccountMismatch(row.userId, 'gift', row.giftBalance, ledger.gift)
      }

      // 有流水但没有钱包行的情况也要报出来（数据被人为清理过）
      for (const userId of netMap.keys()) {
        if (seen.has(userId)) {
          continue
        }

        const ledger = netMap.get(userId)!

        pushAccountMismatch(userId, 'recharge', '0.00', ledger.recharge)
        pushAccountMismatch(userId, 'gift', '0.00', ledger.gift)
      }

      return { checkedUsers: walletRows.length, mismatches }
    },

    /** 充值单相关读方法（充值到账链路用） */
    findRechargeByOutTradeNo(outTradeNo: string) {
      return recharges.findByOutTradeNo(outTradeNo)
    },

    findFreezeByBizNo(bizNo: string) {
      return freezes.findByBizNo(bizNo)
    },

    findFreezeById(freezeId: string) {
      return freezes.findById(freezeId)
    }
  }
}

/**
 * 绑定到**已有事务**的余额服务：调用方自己保证事务边界与提交/回滚。
 * 典型场景：支付回调要「订单置为已支付 + 余额入账」原子提交。
 */
export function walletServiceIn(executor: AppExecutor) {
  return buildWallet(executor)
}

/**
 * 独立使用的余额服务：每个写方法内部开启事务。
 * 调用方拿到的是已经提交/回滚后的结果，不需要关心事务。
 */
export function walletService(db: AppDb) {
  const reads = buildWallet(db)
  const run = async <T>(fn: (tx: AppTx) => Promise<T>): Promise<T> => await db.transaction(async tx => await fn(tx))

  async function reuseCredit(input: Parameters<ReturnType<typeof buildWallet>['credit']>[0]): Promise<CreditResult> {
    return {
      userId: input.userId,
      account: input.account,
      amount: normalizeMoney(input.amount),
      balance: await reads.readBalance(input.userId, input.account),
      reused: true,
      grantId: null
    }
  }

  return {
    getWallet: reads.getWallet,
    assertConsistency: reads.assertConsistency,
    findRechargeByOutTradeNo: reads.findRechargeByOutTradeNo,

    credit: async (input: Parameters<typeof reads.credit>[0]): Promise<CreditResult> => {
      try {
        return await run(tx => buildWallet(tx).credit(input))
      } catch (error) {
        if (error instanceof AlreadyAppliedError) {
          return await reuseCredit(input)
        }
        throw error
      }
    },

    adjust: async (input: Parameters<typeof reads.adjust>[0]): Promise<AdjustResult> => {
      try {
        return await run(tx => buildWallet(tx).adjust(input))
      } catch (error) {
        if (error instanceof AlreadyAppliedError) {
          return await reuseCredit({
            userId: input.userId,
            account: input.account,
            amount: input.amount,
            bizType: 'adjust',
            bizNo: buildAdjustBizNo(input.requestId)
          })
        }
        throw error
      }
    },

    freeze: async (input: Parameters<typeof reads.freeze>[0]): Promise<FreezeResult> => {
      try {
        return await run(tx => buildWallet(tx).freeze(input))
      } catch (error) {
        if (error instanceof AlreadyAppliedError) {
          const row = await reads.findFreezeByBizNo(input.bizNo)
          if (row) {
            return toFreezeResult(row, true)
          }
        }
        throw error
      }
    },

    confirm: async (input: Parameters<typeof reads.confirm>[0]): Promise<FreezeSettleResult> => {
      try {
        return await run(tx => buildWallet(tx).confirm(input))
      } catch (error) {
        // 幂等命中（确认流水已存在）说明此前已确认成功，回滚本次后按已确认返回
        if (error instanceof AlreadyAppliedError) {
          const row = input.freezeId
            ? await reads.findFreezeById(input.freezeId)
            : input.bizNo ? await reads.findFreezeByBizNo(input.bizNo) : null

          if (row && row.status === 'CONFIRMED') {
            return {
              freezeId: row.id,
              bizNo: row.bizNo,
              status: 'CONFIRMED',
              giftAmount: row.giftAmount,
              rechargeAmount: row.rechargeAmount,
              reused: true
            }
          }
        }
        throw error
      }
    },

    release: async (input: Parameters<typeof reads.release>[0]): Promise<FreezeSettleResult> => {
      return await run(tx => buildWallet(tx).release(input))
    },

    expireGiftBatches: async (limit?: number): Promise<ExpireGiftResult> => {
      return await run(tx => buildWallet(tx).expireGiftBatches(limit))
    },

    expireFreezes: async (limit?: number): Promise<ExpireFreezeResult> => {
      return await run(tx => buildWallet(tx).expireFreezes(limit))
    }
  }
}

export type WalletService = ReturnType<typeof walletService>
