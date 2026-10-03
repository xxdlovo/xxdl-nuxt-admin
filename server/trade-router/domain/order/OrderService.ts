/**
 * 订单域服务：下单、确认、支付成功、关闭、交付、超时关闭、在线支付同步。
 *
 * 资金与状态的一致性策略：
 * 1. **下单**在一个事务里完成「扣库存 → 落单 → 锁优惠码 → 冻结余额」，
 *    任何一步失败整体回滚，不会出现「扣了库存没落单」或「冻了钱没库存」；
 *    余额不足直接抛错回滚（不落单）。
 * 2. **在线支付单**在事务外创建（渠道是网络调用，避免长事务），
 *    成功后再用一个小事务回填；失败则在小事务里置 FL 并回滚库存与优惠码。
 * 3. **确认支付**（余额单）与**支付成功**（在线单）都用「条件 UPDATE + affectedRows」
 *    保证重复回调 / 重复点击只生效一次；并发时抛内部错误让事务回滚，外层按「已处理」返回。
 * 4. **关闭订单**统一走 `cancelTx`：释放冻结 → 释放优惠码 → 回滚库存 → 置 CL。
 *    超时任务与人工关闭共用这一条路径，行为一致。
 *
 * 发布方：`dispatchPaidOrder`（支付回调）调用 `markPaid`；`order:expire-close` 任务调用 `expireClose`。
 */
import { AppError } from '#server/utils/appError'
import { type AppDb, type AppExecutor, type AppTx } from '#server/drizzle/db'
import { randomUuid } from '#shared/utils/uuid'
import { isDuplicateKeyError } from '../wallet/repo/sqlUtils'
import { addMinutes, buildOutTradeNo, nowForMysql } from '../pay/utils'
import { payOrderService } from '../pay/PayOrderService'
import { goodsServiceIn } from '../goods/GoodsService'
import type { PriceSource } from '../goods/types'
import { memberServiceIn } from '../member/MemberService'
import { walletServiceIn } from '../wallet/WalletService'
import { fromCents, toCents } from '../wallet/utils'
import { orderRepo, type OrderRow } from './repo/orderRepo'
import {
  ORDER_EXPIRE_BATCH_SIZE,
  ORDER_TTL_MINUTES,
  type OrderCancelSource,
  type OrderCreateInput,
  type OrderCreateResult,
  type OrderExpireCloseResult,
  type OrderFulfillStatus,
  type OrderPayMode,
  type OrderSettleResult,
  type OrderStatus,
  type OrderSummary,
  type OrderSyncResult
} from './types'

const PAY_MODE_BALANCE: OrderPayMode = 'balance'
const PAY_MODE_ONLINE: OrderPayMode = 'online'
const STATUS_PENDING: OrderStatus = 'WP'
const STATUS_COMPLETED: OrderStatus = 'OD'
const STATUS_CLOSED: OrderStatus = 'CL'
const FULFILL_NONE: OrderFulfillStatus = 'none'
const FULFILL_PENDING: OrderFulfillStatus = 'pending'
const FULFILL_DELIVERED: OrderFulfillStatus = 'delivered'

/** 服务类商品的数量恒为 1（人工服务不可复制多份） */
const SERVICE_QUANTITY = 1

/** 关闭原因（落库，用户可见） */
const CLOSE_REASON: Record<OrderCancelSource, string> = {
  user: '用户取消',
  admin: '后台关闭',
  timeout: '超时未支付'
}

/** 并发下状态已被其他请求推进：抛出以回滚本事务，外层按「已处理」返回 */
class OrderAlreadySettledError extends Error {
  constructor() {
    super('order already settled')
    this.name = 'OrderAlreadySettledError'
  }
}

/** 冻结单已不可确认（被人工释放/过期）：外层据此用独立事务关单并给出友好提示 */
class OrderFreezeLostError extends Error {
  constructor(public readonly orderId: string) {
    super('order freeze lost')
    this.name = 'OrderFreezeLostError'
  }
}

type OrderKey = {
  orderId?: string | null
  orderNo?: string | null
}

function toStatus(value: string | null | undefined): OrderStatus {
  return (value ?? STATUS_PENDING) as OrderStatus
}

function toFulfillStatus(value: string | null | undefined): OrderFulfillStatus {
  return (value ?? FULFILL_NONE) as OrderFulfillStatus
}

/** 订单行 → 下单结果（二维码信息由调用方补） */
function toCreateResult(
  row: OrderRow,
  extra: { qrImageUrl?: string | null, qrContent?: string | null, payUrl?: string | null, reused?: boolean } = {}
): OrderCreateResult {
  return {
    orderId: row.id,
    orderNo: row.orderNo,
    status: toStatus(row.status),
    payMode: (row.payMode ?? PAY_MODE_BALANCE) as OrderPayMode,
    fulfillStatus: toFulfillStatus(row.fulfillStatus),
    unitPrice: row.unitPrice,
    priceSource: (row.priceSource ?? 'base') as PriceSource,
    quantity: row.quantity,
    totalAmount: row.totalAmount,
    discountAmount: row.discountAmount,
    payAmount: row.payAmount,
    giftAmount: row.giftAmount,
    rechargeAmount: row.rechargeAmount,
    freezeId: row.freezeId ?? null,
    payOrderId: row.payOrderId ?? null,
    qrImageUrl: extra.qrImageUrl ?? null,
    qrContent: extra.qrContent ?? null,
    payUrl: extra.payUrl ?? null,
    expireAt: row.expireAt ?? null,
    reused: extra.reused ?? false
  }
}

function toSettleResult(row: OrderRow, reused: boolean, giftAmount = row.giftAmount, rechargeAmount = row.rechargeAmount): OrderSettleResult {
  return {
    orderId: row.id,
    orderNo: row.orderNo,
    status: toStatus(row.status),
    fulfillStatus: toFulfillStatus(row.fulfillStatus),
    giftAmount,
    rechargeAmount,
    reused
  }
}

/**
 * 事务内的订单能力：只使用传入的 executor（`AppTx` 或 `AppDb`）。
 * 网络调用（渠道下单/查询/关闭）刻意留在外层，避免把事务拉长。
 */
export function buildOrder(executor: AppExecutor) {
  const repo = orderRepo(executor)
  const goods = goodsServiceIn(executor)
  const members = memberServiceIn(executor)
  const wallet = walletServiceIn(executor)

  /** 按 id 或订单号定位订单 */
  async function findOrderByKey(key: OrderKey): Promise<OrderRow | null> {
    if (key.orderId) {
      return await repo.findById(key.orderId)
    }
    if (key.orderNo) {
      return await repo.findByOrderNo(key.orderNo)
    }

    return null
  }

  /** 冻结信息回填后重新读一次，保证返回的是最终状态 */
  async function reread(orderId: string): Promise<OrderRow> {
    const row = await repo.findById(orderId)

    if (!row) {
      throw new AppError('common.notExist')
    }

    return row
  }

  /**
   * 事务内下单：校验商品 → 解析等级价 → 解析优惠码 → 扣库存 → 落单 → 锁券 → 冻结余额。
   * 余额不足等异常会抛出，由外层事务整体回滚。
   */
  async function createTx(input: OrderCreateInput): Promise<OrderCreateResult> {
    const existing = await repo.findByRequestId(input.requestId)

    if (existing) {
      return toCreateResult(existing, { reused: true })
    }

    const goodsRow = await goods.assertPurchasable(input.goodsId)
    const isService = goodsRow.type === 'service'
    const quantity = isService ? SERVICE_QUANTITY : Math.max(1, Math.floor(input.quantity))

    if (isService && !String(input.contact ?? '').trim()) {
      throw new AppError('module.system.order.contactRequired')
    }

    // 等级价：按下单时的会员等级解析，落单时把来源与等级一起快照下来
    const member = await members.getMember(input.userId)
    const price = await goods.resolvePrice({ goods: goodsRow, levelId: member?.levelId ?? null })
    const totalAmount = fromCents(toCents(price.unitPrice) * quantity)

    const coupon = await members.resolveCoupon({
      code: input.couponCode ?? null,
      userId: input.userId,
      scene: 'consume',
      amount: totalAmount
    })
    const discountAmount = coupon ? coupon.discountAmount : '0.00'
    const payAmount = coupon ? coupon.payableAmount : totalAmount

    if (toCents(payAmount) <= 0) {
      // 0 元订单不进入支付链路：要么用券把价格减到 0（不支持），要么商品价配错
      throw new AppError('module.system.order.payAmountInvalid')
    }

    await goods.decreaseStockOrThrow(goodsRow.id, quantity)

    const orderId = randomUuid()
    const orderNo = buildOutTradeNo('ORD')
    const now = nowForMysql()
    const expireAt = nowForMysql(addMinutes(new Date(), ORDER_TTL_MINUTES))

    try {
      await repo.insert({
        id: orderId,
        orderNo,
        requestId: input.requestId,
        userId: input.userId,
        goodsId: goodsRow.id,
        goodsName: goodsRow.name,
        goodsCover: goodsRow.cover ?? null,
        goodsType: goodsRow.type,
        unitPrice: price.unitPrice,
        priceSource: price.priceSource,
        levelId: price.levelId,
        quantity,
        totalAmount,
        discountAmount,
        payAmount,
        giftAmount: '0.00',
        rechargeAmount: '0.00',
        payMode: input.payMode,
        status: STATUS_PENDING,
        couponId: coupon?.couponId ?? null,
        couponCode: coupon?.code ?? null,
        contact: input.contact ?? null,
        // 服务类订单支付成功后进入「待交付」，其余商品不需要交付
        fulfillStatus: isService ? FULFILL_PENDING : FULFILL_NONE,
        expireAt,
        remark: input.remark ?? null,
        createdBy: input.operatorId ?? null,
        updatedBy: input.operatorId ?? null,
        isDeleted: 0,
        createdAt: now
      })
    } catch (error) {
      // requestId 唯一键冲突：同一提交并发进入，回滚后由外层按幂等返回原单
      if (isDuplicateKeyError(error)) {
        throw new OrderAlreadySettledError()
      }

      throw error
    }

    // 锁定优惠码：与订单号绑定，关闭/发起支付失败时释放
    if (coupon) {
      await members.lockCoupon({
        couponId: coupon.couponId,
        couponCode: coupon.code,
        userId: input.userId,
        scene: 'consume',
        bizNo: orderNo,
        discountAmount,
        giftAmount: '0.00'
      })
    }

    if (input.payMode === PAY_MODE_BALANCE) {
      // ttlMinutes = 0：冻结不设过期，释放权只归订单侧（取消 / 后台关闭 / 超时任务）
      const frozen = await wallet.freeze({
        userId: input.userId,
        bizNo: orderNo,
        amount: payAmount,
        subject: goodsRow.name,
        attach: orderId,
        ttlMinutes: 0,
        operatorId: input.operatorId ?? null
      })

      await repo.attachFreeze({
        id: orderId,
        freezeId: frozen.freezeId,
        giftAmount: frozen.giftAmount,
        rechargeAmount: frozen.rechargeAmount,
        operatorId: input.operatorId ?? null
      })
    }

    return toCreateResult(await reread(orderId))
  }

  /** 回填在线支付单（事务内，网络调用在外层完成） */
  async function attachPayOrder(values: {
    orderId: string
    payOrderId: string
    payChannelCode: string | null
    operatorId?: string | null
  }) {
    await repo.attachPayOrder({
      id: values.orderId,
      payOrderId: values.payOrderId,
      payChannelCode: values.payChannelCode,
      operatorId: values.operatorId ?? null
    })
  }

  /**
   * 在线支付单创建失败：置 FL，并把库存与优惠码还回去。
   * 失败原因写进 fail_reason，订单页可删除，用户可以重新下单。
   */
  async function failOnlinePayment(values: { orderId: string, message: string, operatorId?: string | null }) {
    const row = await repo.findById(values.orderId)

    if (!row) {
      throw new AppError('common.notExist')
    }

    await repo.markFailed({
      id: row.id,
      failReason: values.message.slice(0, 500),
      operatorId: values.operatorId ?? null
    })
    await goods.rollbackStock(row.goodsId, row.quantity)

    if (row.couponId) {
      await members.releaseCoupon({ bizNo: row.orderNo, operatorId: values.operatorId ?? null })
    }
  }

  /**
   * 确认支付（余额单）：确认冻结 → 置已完成 → 核销券 → 加销量。
   * 冻结已被释放时抛 `OrderFreezeLostError`，由外层用独立事务关单（否则本次回滚会把关单一起回滚）。
   */
  async function confirmTx(input: OrderKey & { operatorId?: string | null }): Promise<OrderSettleResult> {
    const row = await findOrderByKey(input)

    if (!row) {
      throw new AppError('common.notExist')
    }

    if (row.status === STATUS_COMPLETED) {
      return toSettleResult(row, true)
    }

    if (row.status !== STATUS_PENDING) {
      throw new AppError('module.system.order.notPayable')
    }

    if (row.payMode !== PAY_MODE_BALANCE) {
      throw new AppError('module.system.order.wrongPayMode')
    }

    let settled

    try {
      settled = await wallet.confirm({
        freezeId: row.freezeId,
        bizNo: row.freezeId ? null : row.orderNo,
        operatorId: input.operatorId ?? null
      })
    } catch (error) {
      if (
        error instanceof AppError
        && (error.i18nKey === 'module.system.member.freezeNotFound'
          || error.i18nKey === 'module.system.member.freezeNotFrozen')
      ) {
        throw new OrderFreezeLostError(row.id)
      }

      throw error
    }

    const now = nowForMysql()
    const affected = await repo.markCompleted({
      id: row.id,
      paidAt: now,
      finishedAt: now,
      operatorId: input.operatorId ?? null
    })

    if (affected === 0) {
      throw new OrderAlreadySettledError()
    }

    if (row.couponId) {
      await members.markCouponUsed({ bizNo: row.orderNo, operatorId: input.operatorId ?? null })
    }
    await goods.increaseSales(row.goodsId, row.quantity)

    return toSettleResult(await reread(row.id), settled.reused, settled.giftAmount, settled.rechargeAmount)
  }

  /**
   * 在线支付成功（回调 / 主动同步 / 后台代确认共用）：
   * 只推进订单与优惠码、加销量，不动余额（钱来自渠道）。
   */
  async function markPaidTx(input: { orderNo: string, operatorId?: string | null }): Promise<OrderSettleResult> {
    const row = await repo.findByOrderNo(input.orderNo)

    if (!row) {
      throw new AppError('module.system.order.notFound')
    }

    if (row.status === STATUS_COMPLETED) {
      return toSettleResult(row, true)
    }

    if (row.status !== STATUS_PENDING) {
      throw new AppError('module.system.order.notPayable')
    }

    const now = nowForMysql()
    const affected = await repo.markCompleted({
      id: row.id,
      paidAt: now,
      finishedAt: now,
      operatorId: input.operatorId ?? null
    })

    if (affected === 0) {
      throw new OrderAlreadySettledError()
    }

    if (row.couponId) {
      await members.markCouponUsed({ bizNo: row.orderNo, operatorId: input.operatorId ?? null })
    }
    await goods.increaseSales(row.goodsId, row.quantity)

    return toSettleResult(await reread(row.id), false, '0.00', '0.00')
  }

  /**
   * 关闭订单（用户取消 / 后台关闭 / 超时任务共用）：
   * 释放冻结（幂等，冻结已释放不报错）→ 释放优惠码 → 回滚库存 → 置 CL。
   */
  async function cancelTx(input: OrderKey & {
    reason?: string | null
    source: OrderCancelSource
    operatorId?: string | null
  }): Promise<OrderSettleResult> {
    const row = await findOrderByKey(input)

    if (!row) {
      throw new AppError('common.notExist')
    }

    if (row.status === STATUS_CLOSED) {
      return toSettleResult(row, true)
    }

    if (row.status !== STATUS_PENDING) {
      throw new AppError('module.system.order.notClosable')
    }

    if (row.freezeId) {
      try {
        await wallet.release({
          freezeId: row.freezeId,
          reason: input.reason ?? CLOSE_REASON[input.source],
          operatorId: input.operatorId ?? null
        })
      } catch (error) {
        // 冻结单被人工释放过：释放本身是幂等的，这里只忽略状态类错误，其余照旧抛出
        if (!(error instanceof AppError)) {
          throw error
        }
      }
    }

    if (row.couponId) {
      await members.releaseCoupon({ bizNo: row.orderNo, operatorId: input.operatorId ?? null })
    }

    await goods.rollbackStock(row.goodsId, row.quantity)

    const now = nowForMysql()
    const affected = await repo.markClosed({
      id: row.id,
      closedAt: now,
      closeReason: input.reason ?? CLOSE_REASON[input.source],
      operatorId: input.operatorId ?? null
    })

    if (affected === 0) {
      throw new OrderAlreadySettledError()
    }

    return toSettleResult(await reread(row.id), false)
  }

  /** 服务交付：已支付且待交付时才允许 */
  async function fulfillTx(input: OrderKey & { remark?: string | null, operatorId?: string | null }): Promise<OrderSettleResult> {
    const row = await findOrderByKey(input)

    if (!row) {
      throw new AppError('common.notExist')
    }

    if (row.fulfillStatus === FULFILL_DELIVERED) {
      return toSettleResult(row, true)
    }

    if (row.status !== STATUS_COMPLETED || row.fulfillStatus !== FULFILL_PENDING) {
      throw new AppError('module.system.order.notFulfillable')
    }

    const affected = await repo.markFulfilled({
      id: row.id,
      fulfilledAt: nowForMysql(),
      fulfillRemark: input.remark ?? null,
      operatorId: input.operatorId ?? null
    })

    if (affected === 0) {
      throw new OrderAlreadySettledError()
    }

    return toSettleResult(await reread(row.id), false)
  }

  return {
    getById: async (orderId: string) => await repo.findById(orderId),
    getByOrderNo: async (orderNo: string) => await repo.findByOrderNo(orderNo),
    findByRequestId: async (requestId: string) => await repo.findByRequestId(requestId),
    findOrderByKey,
    toCreateResult,
    createTx,
    attachPayOrder,
    failOnlinePayment,
    confirmTx,
    markPaidTx,
    cancelTx,
    fulfillTx,
    listExpiredPending: async (limit: number) => await repo.listExpiredPending(limit, nowForMysql()),
    pageByUser: async (params: Parameters<typeof repo.pageByUser>[0]) => await repo.pageByUser(params),
    countPending: async () => await repo.countPending(),
    countPendingFulfill: async () => await repo.countPendingFulfill(),
    sumByRange: async (range: { createdFrom?: string | null, createdTo?: string | null }) => await repo.sumByRange(range)
  }
}

/** 内部错误需要在 wrapper 里识别，这里按需导出类型守卫 */
export function isOrderAlreadySettled(error: unknown): boolean {
  return error instanceof OrderAlreadySettledError
}

/**
 * 独立使用的订单服务：负责事务边界与网络调用编排。
 *
 * - `create`：读幂等 → 事务下单 → 在线单在事务外创建渠道支付单，回填/回滚各用一个小事务；
 * - `confirm` / `cancel` / `fulfill` / `markPaid`：各自一个事务，并发冲突按「已处理」返回；
 * - `cancel` 额外在事务外尽力关闭渠道支付单（失败不影响本地关单）；
 * - `expireClose`：逐单一个事务，单笔失败不影响其余订单；
 * - `sync`：先在事务外查渠道，再在事务内按幂等路径推进。
 */
export function orderService(db: AppDb) {
  const reads = buildOrder(db)
  const run = async <T>(fn: (tx: AppTx) => Promise<T>): Promise<T> => await db.transaction(async tx => await fn(tx))

  /** 条件更新抢输时的统一兜底：重新读一次，已是目标状态就按幂等返回 */
  async function settleWithIdempotentGuard<T>(
    action: () => Promise<T>,
    fallback: () => Promise<T | null>
  ): Promise<T> {
    try {
      return await action()
    } catch (error) {
      if (isOrderAlreadySettled(error)) {
        const latest = await fallback()

        if (latest) {
          return latest
        }
      }

      throw error
    }
  }

  /** 在线支付成功：回调 / 同步 / 后台共用，幂等（抽成局部函数，避免在返回对象里用 this） */
  async function markPaid(orderNo: string, operatorId: string | null = null): Promise<OrderSettleResult> {
    try {
      return await run(tx => buildOrder(tx).markPaidTx({ orderNo, operatorId }))
    } catch (error) {
      if (isOrderAlreadySettled(error)) {
        const row = await reads.getByOrderNo(orderNo)

        if (row) {
          return toIdempotentSettle(row)
        }
      }

      throw error
    }
  }

  /**
   * 关闭订单（抽成局部函数：`sync` 自愈关闭时也要用，对象字面量里没法互相引用）。
   * 本地关单在事务内完成，渠道关单失败不影响本地结果。
   */
  async function cancelOrder(input: OrderKey & {
    reason?: string | null
    source: OrderCancelSource
    operatorId?: string | null
  }): Promise<OrderSettleResult> {
    const result = await settleWithIdempotentGuard(
      async () => await run(tx => buildOrder(tx).cancelTx(input)),
      async () => {
        const row = await reads.findOrderByKey(input)

        return row ? toIdempotentSettle(row) : null
      }
    )

    if (!result.reused) {
      await closeChannelPayment(db, input)
    }

    return result
  }

  return {
    getById: reads.getById,
    getByOrderNo: reads.getByOrderNo,
    listExpiredPending: reads.listExpiredPending,
    pageByUser: reads.pageByUser,
    markPaid,

    async create(input: OrderCreateInput): Promise<OrderCreateResult> {
      const existing = await reads.findByRequestId(input.requestId)

      if (existing) {
        return await fillPayInfo(db, reads.toCreateResult(existing, { reused: true }))
      }

      const created = await settleWithIdempotentGuard(
        async () => await run(tx => buildOrder(tx).createTx(input)),
        async () => {
          const row = await reads.findByRequestId(input.requestId)

          return row ? reads.toCreateResult(row, { reused: true }) : null
        }
      )

      if (input.payMode !== PAY_MODE_ONLINE) {
        return created
      }

      // 渠道下单是网络调用：放在事务外，成功后再回填，失败则回滚库存与优惠码
      try {
        const payments = payOrderService(db)
        const payOrder = await payments.createPayment({
          outTradeNo: created.orderNo,
          amount: created.payAmount,
          subject: `订单 ${created.orderNo}`,
          bizType: 'order',
          attach: `order:${created.orderId}`,
          notifyUrl: input.notifyUrl ?? null,
          origin: input.origin ?? null
        }, { operatorId: input.operatorId ?? null })

        await run(tx => buildOrder(tx).attachPayOrder({
          orderId: created.orderId,
          payOrderId: payOrder.id,
          payChannelCode: payOrder.channelCode,
          operatorId: input.operatorId ?? null
        }))

        return {
          ...created,
          payOrderId: payOrder.id,
          qrImageUrl: payOrder.qrImageUrl ?? null,
          qrContent: payOrder.qrContent ?? null,
          payUrl: payOrder.payUrl ?? null,
          expireAt: payOrder.expireAt ?? created.expireAt
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : '发起支付失败'

        await run(tx => buildOrder(tx).failOnlinePayment({
          orderId: created.orderId,
          message,
          operatorId: input.operatorId ?? null
        }))

        throw new AppError('module.system.order.payCreateFailed', { message, cause: error })
      }
    },

    /** 余额单确认支付（会员自助或后台代确认） */
    async confirm(input: OrderKey & { operatorId?: string | null }): Promise<OrderSettleResult> {
      try {
        return await run(tx => buildOrder(tx).confirmTx(input))
      } catch (error) {
        if (error instanceof OrderFreezeLostError) {
          // 冻结已不可用：用独立事务把订单关掉（本次失败的事务已回滚），再给用户明确提示
          await run(tx => buildOrder(tx).cancelTx({
            orderId: error.orderId,
            reason: '冻结已释放，订单自动关闭',
            source: 'admin',
            operatorId: input.operatorId ?? null
          })).catch(() => undefined)

          throw new AppError('module.system.order.freezeExpired')
        }

        if (isOrderAlreadySettled(error)) {
          const row = await reads.findOrderByKey(input)

          if (row) {
            return toIdempotentSettle(row)
          }
        }

        throw error
      }
    },

    /** 关闭订单（取消 / 后台关闭 / 超时） */
    cancel: cancelOrder,

    /** 服务交付 */
    async fulfill(input: OrderKey & { remark?: string | null, operatorId?: string | null }): Promise<OrderSettleResult> {
      return await settleWithIdempotentGuard(
        async () => await run(tx => buildOrder(tx).fulfillTx(input)),
        async () => {
          const row = await reads.findOrderByKey(input)

          return row?.fulfillStatus === FULFILL_DELIVERED ? toIdempotentSettle(row) : null
        }
      )
    },

    /**
     * 超时关闭：逐单独立事务，单笔失败不影响其余订单。
     *
     * 关单前先看**本地支付单**：如果它已经是 `OD`（回调到了但业务后置没做完，
     * 或订单是被主动查询推进的），这笔钱其实收到了，必须按支付成功推进而不是关掉；
     * 否则会出现「钱在渠道、订单被关」且此后 `sync` 也不会再自愈（订单已非 WP）。
     * 只读本地状态，不发渠道请求（一次任务最多扫 200 单，逐单外呼不可接受）；
     * 回调完全没到达的情况仍由人工/对账介入，见 doc/main/8.payment/7.integration.md。
     */
    async expireClose(limit = ORDER_EXPIRE_BATCH_SIZE): Promise<OrderExpireCloseResult> {
      const rows = await reads.listExpiredPending(limit)
      const failures: Array<{ orderNo: string, message: string }> = []
      let closedCount = 0
      let recoveredCount = 0

      for (const row of rows) {
        try {
          // 支付单已支付：先补做业务后置（幂等），不能误关
          if (row.payOrderId) {
            const payOrder = await payOrderService(db).getById(row.payOrderId)

            if (payOrder.status === 'OD') {
              const settled = await markPaid(row.orderNo, null)

              if (!settled.reused) {
                recoveredCount += 1
              }

              continue
            }
          }

          const result = await run(tx => buildOrder(tx).cancelTx({
            orderId: row.id,
            reason: CLOSE_REASON.timeout,
            source: 'timeout',
            operatorId: null
          }))

          if (!result.reused) {
            closedCount += 1
          }

          if (!result.reused && row.payOrderId) {
            await closeChannelPayment(db, { orderId: row.id })
          }
        } catch (error) {
          failures.push({
            orderNo: row.orderNo,
            message: error instanceof Error ? error.message : 'unknown error'
          })
        }
      }

      return { scanned: rows.length, closedCount, recoveredCount, failures }
    },

    /** 主动同步在线支付状态：先在事务外查渠道，再走与回调相同的幂等路径 */
    async sync(input: OrderKey & { operatorId?: string | null }): Promise<OrderSyncResult> {
      const row = await reads.findOrderByKey(input)

      if (!row) {
        throw new AppError('common.notExist')
      }

      if (row.status !== STATUS_PENDING || !row.payOrderId) {
        return {
          orderNo: row.orderNo,
          status: toStatus(row.status),
          payOrderStatus: null,
          changed: false
        }
      }

      const payOrder = await payOrderService(db).queryPayment(row.payOrderId, { operatorId: input.operatorId ?? null })

      /**
       * 支付单已被关闭 / 发起失败（渠道过期、后台关过支付单等）：
       * 订单不可能再支付，就地自愈关闭（释放冻结/优惠码/回滚库存），
       * 不必等 `order:expire-close` 任务到点才处理。
       */
      if (payOrder.status === 'CL' || payOrder.status === 'FL') {
        const closed = await cancelOrder({
          orderId: row.id,
          reason: `支付单已${payOrder.status === 'CL' ? '关闭' : '失败'}`,
          source: 'admin',
          operatorId: input.operatorId ?? null
        })

        return {
          orderNo: row.orderNo,
          status: closed.status,
          payOrderStatus: payOrder.status,
          changed: !closed.reused
        }
      }

      if (payOrder.status !== 'OD') {
        return {
          orderNo: row.orderNo,
          status: toStatus(row.status),
          payOrderStatus: payOrder.status,
          changed: false
        }
      }

      const settled = await markPaid(row.orderNo, input.operatorId ?? null)

      return {
        orderNo: row.orderNo,
        status: settled.status,
        payOrderStatus: payOrder.status,
        changed: !settled.reused
      }
    },

    /** 看板统计 */
    async summary(range: { createdFrom?: string | null, createdTo?: string | null }): Promise<OrderSummary> {
      const todayFrom = `${nowForMysql().slice(0, 10)} 00:00:00`
      const [rangeSum, todaySum, pendingCount, pendingFulfillCount] = await Promise.all([
        reads.sumByRange(range),
        reads.sumByRange({ createdFrom: todayFrom, createdTo: null }),
        reads.countPending(),
        reads.countPendingFulfill()
      ])

      return {
        totalCount: rangeSum.totalCount,
        totalAmount: rangeSum.totalAmount,
        pendingCount,
        pendingFulfillCount,
        todayCount: todaySum.totalCount,
        todayAmount: todaySum.totalAmount
      }
    }
  }
}

/** 幂等返回：用当前行状态拼一个「未做任何变更」的结果 */
function toIdempotentSettle(row: OrderRow): OrderSettleResult {
  return toSettleResult(row, true)
}

/** 在线单：把渠道支付单的二维码信息补进下单结果（幂等返回原单时用） */
async function fillPayInfo(db: AppDb, created: OrderCreateResult): Promise<OrderCreateResult> {
  if (!created.payOrderId) {
    return created
  }

  const row = await buildOrder(db).getById(created.orderId)

  if (!row?.payOrderId) {
    return created
  }

  const payOrder = await payOrderService(db).getById(row.payOrderId)

  return {
    ...created,
    qrImageUrl: payOrder.qrImageUrl ?? null,
    qrContent: payOrder.qrContent ?? null,
    payUrl: payOrder.payUrl ?? null
  }
}

/** 尽力关闭渠道支付单：失败不影响本地关单（渠道侧可能已支付/已关闭） */
async function closeChannelPayment(
  db: AppDb,
  key: OrderKey
): Promise<void> {
  try {
    const row = await buildOrder(db).findOrderByKey(key)

    if (!row?.payOrderId) {
      return
    }

    await payOrderService(db).closePayment(row.payOrderId, { operatorId: null })
  } catch {
    // 渠道关闭失败只记录在渠道侧，本地订单状态已经确定，不再抛出
  }
}

export type OrderService = ReturnType<typeof orderService>
