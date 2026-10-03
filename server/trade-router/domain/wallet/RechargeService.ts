/**
 * 充值域服务：发起充值、到账入账、关闭、未到账补偿。
 *
 * 与支付模块的衔接：
 * - 发起充值复用支付领域服务 `payOrderService`（`bizType = 'recharge'`），
 *   支付单与充值单通过 `out_trade_no` 一一对应；
 * - 到账由支付回调触发（`PayNotifyDispatcher` 的 `onPaid` 注入点），
 *   本文件的 `credit` 是**唯一的到账入口**，也可以被补偿任务直接调用（幂等）。
 *
 * 幂等：充值单 `out_trade_no` 唯一 + 钱包流水 `dedup_key` 唯一 + `markCredited` 条件更新，
 * 三重保证重复回调/重复补偿不会重复加钱。
 */
import { AppError } from '#server/utils/appError'
import { type AppDb, type AppExecutor, type AppTx } from '#server/drizzle/db'
import { randomUuid } from '#shared/utils/uuid'
import { buildOutTradeNo, nowForMysql } from '../pay/utils'
import { payOrderService } from '../pay/PayOrderService'
import { payChannelRepo } from '../pay/repo/payChannelRepo'
import { memberServiceIn } from '../member/MemberService'
import { rechargeRepo, type RechargeRow } from './repo/rechargeRepo'
import { walletServiceIn } from './WalletService'
import { isPositiveMoney, normalizeMoney } from './utils'

/** 发起充值的入参 */
export type CreateRechargeInput = {
  userId: string
  /** 充值金额（计入充值金） */
  amount: string | number
  couponCode?: string | null
  notifyUrl?: string | null
  /** 当前请求 origin：渠道未配 notify_url 时用于推导回调地址 */
  origin?: string | null
  operatorId?: string | null
  remark?: string | null
}

export type CreateRechargeResult = {
  rechargeId: string
  outTradeNo: string
  payOrderId: string | null
  status: string
  amount: string
  giftAmount: string
  discountAmount: string
  payAmount: string
  channelCode: string | null
  channelName: string | null
  qrImageUrl: string | null
  qrContent: string | null
  payUrl: string | null
  expireAt: string | null
}

export type CreditRechargeResult = {
  outTradeNo: string
  credited: boolean
  reused: boolean
  amount: string
  giftAmount: string
}

function buildRecharge(executor: AppExecutor) {
  const repo = rechargeRepo(executor)
  const wallet = walletServiceIn(executor)
  const members = memberServiceIn(executor)
  const channels = payChannelRepo(executor)
  const payments = payOrderService(executor)

  /** 发起充值：解析优惠码 → 落充值单 → 锁券 → 调支付模块下单 */
  async function create(input: CreateRechargeInput): Promise<CreateRechargeResult> {
    const operatorId = input.operatorId ?? null
    const amount = normalizeMoney(input.amount)

    // 渠道必须「启用 + 已通过测试配置」，与支付测试页同口径
    const channel = await channels.findEnabled({})

    if (!channel) {
      throw new AppError('module.system.payChannel.notConfigured')
    }

    if (channel.verifyStatus !== 1) {
      throw new AppError('module.system.payChannel.notVerified', { message: channel.configName })
    }

    const coupon = await members.resolveCoupon({
      code: input.couponCode ?? null,
      userId: input.userId,
      scene: 'recharge',
      amount
    })

    const payAmount = coupon ? coupon.payableAmount : amount
    const giftAmount = coupon ? coupon.giftAmount : '0.00'
    const discountAmount = coupon ? coupon.discountAmount : '0.00'
    const outTradeNo = buildOutTradeNo('RCH')
    const rechargeId = randomUuid()
    const expireAt = nowForMysql(new Date(Date.now() + 30 * 60 * 1000))

    await repo.insert({
      id: rechargeId,
      outTradeNo,
      userId: input.userId,
      amount,
      giftAmount,
      discountAmount,
      payAmount,
      couponId: coupon?.couponId ?? null,
      couponCode: coupon?.code ?? null,
      status: 'WP',
      payChannelCode: channel.channelCode,
      expireAt,
      remark: input.remark ?? null,
      createdBy: operatorId,
      updatedBy: operatorId,
      isDeleted: 0
    })

    /**
     * 渠道下单 + 锁券都放在 try 里：任一失败都要把充值单置 `FL` 并释放占用的优惠码。
     *
     * 锁券失败（例如同一用户超出每人可用次数 `couponUsedUp`）如果不进这个分支，
     * 会留下「充值单已落库 WP、没有支付单、券也没释放」的悬挂状态 ——
     * 用户页面只能轮询到超时，券的每人次数被白占。
     */
    try {
      // 锁定优惠码：与充值单号绑定，关闭/失败时释放
      if (coupon) {
        await members.lockCoupon({
          couponId: coupon.couponId,
          couponCode: coupon.code,
          userId: input.userId,
          scene: 'recharge',
          bizNo: outTradeNo,
          discountAmount,
          giftAmount
        })
      }

      const order = await payments.createPayment({
        channelId: channel.id,
        outTradeNo,
        amount: payAmount,
        subject: `会员充值 ${amount} 元`,
        bizType: 'recharge',
        notifyUrl: input.notifyUrl ?? null,
        attach: `recharge:${rechargeId}`,
        origin: input.origin ?? null
      }, { operatorId })

      /**
       * 回填支付单信息：失败**不能**走下面的 `FL` 分支 ——
       * 支付单已经落到渠道侧了，置 `FL` 会造成「渠道能收到钱、本地单据却是失败」的孤岛。
       * 回填失败时保持充值单 `WP`：回调按 `out_trade_no` 认单照样能入账，
       * 补偿任务 `listPendingWithPaidOrder` 也是按 `out_trade_no` 关联支付单的，同样能捞回来。
       */
      try {
        await repo.attachPayOrder({
          id: rechargeId,
          payOrderId: order.id,
          payChannelCode: order.channelCode,
          operatorId
        })
      } catch {
        // 静默：上面的注释说明了为什么可以吞掉
      }

      return {
        rechargeId,
        outTradeNo,
        payOrderId: order.id,
        status: order.status,
        amount,
        giftAmount,
        discountAmount,
        payAmount,
        channelCode: order.channelCode,
        channelName: channel.configName,
        qrImageUrl: order.qrImageUrl ?? null,
        qrContent: order.qrContent ?? null,
        payUrl: order.payUrl ?? null,
        expireAt: order.expireAt ?? expireAt
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '发起支付失败'

      await repo.markFailed({ id: rechargeId, reason: message, operatorId })
      // 发起失败要释放占用的券，避免用户次数被白扣（没锁成功时释放是幂等空操作）
      if (coupon) {
        await members.releaseCoupon({ bizNo: outTradeNo, operatorId })
      }

      throw new AppError('module.system.memberRecharge.createFailed', { message, cause: error })
    }
  }

  /**
   * 到账入账（唯一入口）。
   * 调用方：支付回调（onPaid）与「未到账补偿」。
   */
  async function credit(outTradeNo: string, operatorId: string | null = null): Promise<CreditRechargeResult> {
    const row = await repo.findByOutTradeNo(outTradeNo)

    if (!row) {
      throw new AppError('module.system.memberRecharge.notFound')
    }

    if (row.status === 'OD') {
      return { outTradeNo, credited: false, reused: true, amount: row.amount, giftAmount: row.giftAmount }
    }

    const now = nowForMysql()
    const affected = await repo.markCredited({
      id: row.id,
      paidAt: row.paidAt ?? now,
      creditedAt: now,
      payOrderId: row.payOrderId,
      payChannelCode: row.payChannelCode,
      operatorId
    })

    if (affected === 0) {
      // 并发下已被其他请求到账
      return { outTradeNo, credited: false, reused: true, amount: row.amount, giftAmount: row.giftAmount }
    }

    // 充值金入账
    await wallet.credit({
      userId: row.userId,
      account: 'recharge',
      amount: row.amount,
      bizType: 'recharge',
      bizNo: outTradeNo,
      reason: '充值到账',
      operatorId
    })

    // 赠送金入账（独立幂等键，金额为 0 时跳过）
    if (isPositiveMoney(row.giftAmount)) {
      await wallet.credit({
        userId: row.userId,
        account: 'gift',
        amount: row.giftAmount,
        bizType: 'recharge',
        bizNo: `${outTradeNo}:gift`,
        giftSource: 'campaign',
        reason: '充值赠送',
        operatorId
      })
    }

    // 核销优惠码
    if (row.couponId) {
      await members.markCouponUsed({ bizNo: outTradeNo, operatorId })
    }

    return { outTradeNo, credited: true, reused: false, amount: row.amount, giftAmount: row.giftAmount }
  }

  /** 关闭未支付充值单（同时关闭支付单并释放优惠码） */
  async function close(input: { rechargeId?: string | null; outTradeNo?: string | null; reason?: string | null; operatorId?: string | null }) {
    const operatorId = input.operatorId ?? null
    const row = input.rechargeId
      ? await repo.findById(input.rechargeId)
      : input.outTradeNo ? await repo.findByOutTradeNo(input.outTradeNo) : null

    if (!row) {
      throw new AppError('module.system.memberRecharge.notFound')
    }

    if (row.status === 'CL') {
      return { closed: false, reused: true }
    }

    if (row.status !== 'WP') {
      throw new AppError('module.system.memberRecharge.notClosable')
    }

    /**
     * 已支付不能关闭：否则「钱在渠道、账在本地」对不上。
     *
     * 先看本地支付单；本地还是待支付时再问一次渠道（管理员点关闭是一次人工操作，
     * 多发一次查询可以接受）。渠道不可达/quota 限制时按本地状态判断，不阻断人工关闭。
     */
    if (row.payOrderId) {
      const localPayOrder = await payments.getById(row.payOrderId)
      let payStatus = localPayOrder.status

      if (payStatus === 'WP') {
        try {
          const queried = await payments.queryPayment(row.payOrderId, { operatorId })
          payStatus = queried.status
        } catch {
          payStatus = localPayOrder.status
        }
      }

      if (payStatus === 'OD') {
        throw new AppError('module.system.memberRecharge.paidCannotClose')
      }
    }

    const affected = await repo.markClosed({ id: row.id, reason: input.reason ?? null, operatorId })

    if (affected === 0) {
      return { closed: false, reused: true }
    }

    if (row.payOrderId) {
      try {
        await payments.closePayment(row.payOrderId, { operatorId })
      } catch {
        // 支付单可能已支付/已关闭：关闭失败不影响充值单状态
      }
    }

    if (row.couponId) {
      await members.releaseCoupon({ bizNo: row.outTradeNo, operatorId })
    }

    return { closed: true, reused: false }
  }

  /**
   * 未到账补偿：本地待支付但支付单已支付成功的充值单。
   * 返回每笔的处理结果，便于在页面上展示。
   */
  async function retryPending(limit = 50, operatorId: string | null = null) {
    const rows = await repo.listPendingWithPaidOrder(limit)
    const results: Array<{ outTradeNo: string; ok: boolean; message: string }> = []

    for (const row of rows) {
      try {
        const credited = await credit(row.outTradeNo, operatorId)
        results.push({
          outTradeNo: row.outTradeNo,
          ok: credited.credited,
          message: credited.credited ? '补偿到账成功' : '已到账（幂等跳过）'
        })
      } catch (error) {
        results.push({
          outTradeNo: row.outTradeNo,
          ok: false,
          message: error instanceof Error ? error.message : '补偿失败'
        })
      }
    }

    return { scanned: rows.length, results }
  }

  /** 待补偿数量（对账页展示用） */
  async function countPending(limit = 200) {
    const rows = await repo.listPendingWithPaidOrder(limit)

    return rows.length
  }

  return {
    create,
    credit,
    close,
    retryPending,
    countPending,
    findRecharge: (outTradeNo: string): Promise<RechargeRow | null> => repo.findByOutTradeNo(outTradeNo)
  }
}

/** 绑定到已有事务（回调链路：改支付单 + 入账一起提交） */
export function rechargeServiceIn(executor: AppExecutor) {
  return buildRecharge(executor)
}

/** 独立使用：写方法自带事务 */
export function rechargeService(db: AppDb) {
  const reads = buildRecharge(db)
  const run = async <T>(fn: (tx: AppTx) => Promise<T>): Promise<T> => await db.transaction(async tx => await fn(tx))

  return {
    ...reads,
    create: async (input: CreateRechargeInput) => await run(tx => buildRecharge(tx).create(input)),
    credit: async (outTradeNo: string, operatorId: string | null = null) => await run(tx => buildRecharge(tx).credit(outTradeNo, operatorId)),
    close: async (input: Parameters<typeof reads.close>[0]) => await run(tx => buildRecharge(tx).close(input)),
    retryPending: async (limit?: number, operatorId?: string | null) => await run(tx => buildRecharge(tx).retryPending(limit, operatorId ?? null))
  }
}

export type RechargeService = ReturnType<typeof rechargeService>
