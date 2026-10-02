/**
 * 统一支付订单领域服务（业务唯一入口）。
 *
 * 上层（tRPC / 未来充值、订单模块 / 对账任务）只调用这里的方法，
 * 不直接接触渠道适配器，也不直接接触数据库：
 * 取数写数一律通过 repo/payOrderRepo、repo/payNotifyLogRepo（mapper 层）。
 */
import { AppError } from '#server/utils/appError'
import { randomUuid } from '#shared/utils/uuid'
import { getPayChannelRuntimeById, resolvePayChannel } from './PayChannelResolver'
import type { PayDb } from './db'
import { getPayProvider } from './providers'
import { payNotifyLogRepo } from './repo/payNotifyLogRepo'
import { payOrderRepo } from './repo/payOrderRepo'
import { canApplyStatusChange, isClosableStatus, isExpired, isPaidStatus } from './statusMap'
import { PayApiError, type PayCreateInput, type PayOrderRow } from './types'
import {
  addMinutes,
  asJsonValue,
  buildOutTradeNo,
  mergeProviderData,
  normalizeAmount,
  nowForMysql,
  resolveNotifyUrl,
  secondsSinceMysqlDateTime,
  toErrorMessage,
  truncateText
} from './utils'

export type PayOperatorMeta = {
  operatorId?: string | null
  clientIp?: string | null
  userAgent?: string | null
}

/** 主动查询的最小间隔（秒）：轮询会反复触发，避免把平台查询接口打爆 */
const MIN_ACTIVE_QUERY_INTERVAL_SECONDS = 3

export type CreatePayOrderInput = {
  channelId?: string | null
  channelCode?: string | null
  amount: string | number
  subject: string
  bizType?: string | null
  attach?: string | null
  remark?: string | null
  notifyUrl?: string | null
  returnUrl?: string | null
  cancelUrl?: string | null
  /** 当次请求的 origin，用于在渠道未配置 notify_url 时推导回调地址 */
  origin?: string | null
  outTradeNo?: string | null
}

export function payOrderService(db: PayDb) {
  const orderRepo = payOrderRepo(db)
  const logRepo = payNotifyLogRepo(db)

  async function getByIdOrThrow(orderId: string): Promise<PayOrderRow> {
    const row = await orderRepo.findById(orderId)

    if (!row) {
      throw new AppError('common.notExist')
    }

    return row
  }

  /** 生成一个库中不存在的订单号（唯一索引仍是最终保证） */
  async function pickOutTradeNo() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const candidate = buildOutTradeNo()
      if (!(await orderRepo.existsOutTradeNo(candidate))) {
        return candidate
      }
    }

    throw new AppError('module.system.payOrder.createFailed', { message: '生成订单号失败' })
  }

  return {
    getById: getByIdOrThrow,

    async getByOutTradeNo(outTradeNo: string): Promise<PayOrderRow | null> {
      return await orderRepo.findByOutTradeNo(outTradeNo)
    },

    /**
     * 统一下单：解析渠道 → 调适配器 → 落库。
     * 适配器失败时也会落一条 FL 订单（便于在支付记录里排查），然后把错误抛给调用方。
     */
    async createPayment(input: CreatePayOrderInput, meta: PayOperatorMeta = {}): Promise<PayOrderRow> {
      const amount = normalizeAmount(input.amount)
      const subject = String(input.subject ?? '').trim()

      if (!subject) {
        throw new AppError('module.system.payOrder.subjectRequired')
      }

      const channel = await resolvePayChannel(db, {
        channelId: input.channelId,
        channelCode: input.channelCode
      })
      const provider = getPayProvider(channel.channelCode)

      if (!provider) {
        throw new AppError('module.system.payChannel.providerUnsupported', { message: channel.channelCode })
      }

      const notifyUrl = resolveNotifyUrl({
        override: input.notifyUrl,
        configured: channel.notifyUrl,
        origin: input.origin,
        channelCode: channel.channelCode
      })

      if (!notifyUrl) {
        throw new AppError('module.system.payChannel.notifyUrlRequired')
      }

      const outTradeNo = input.outTradeNo?.trim() || await pickOutTradeNo()
      const currency = channel.currency || 'CNY'
      const id = randomUuid()
      const expireAt = nowForMysql(addMinutes(new Date(), channel.orderTimeoutMinutes))

      const baseValues = {
        id,
        outTradeNo,
        channelId: channel.id,
        channelCode: channel.channelCode,
        bizType: input.bizType?.trim() || 'test',
        subject,
        amount,
        currency,
        notifyUrl,
        attach: input.attach ?? null,
        clientIp: meta.clientIp ?? null,
        userAgent: truncateText(meta.userAgent, 255),
        expireAt,
        createdBy: meta.operatorId ?? null,
        remark: input.remark ?? null
      }

      const createInput: PayCreateInput = {
        outTradeNo,
        amount,
        currency,
        subject,
        notifyUrl,
        returnUrl: input.returnUrl ?? channel.returnUrl,
        cancelUrl: input.cancelUrl ?? channel.cancelUrl,
        clientIp: meta.clientIp ?? null,
        attach: input.attach ?? null
      }

      try {
        const result = await provider.createPayment(channel, createInput)

        await orderRepo.insert({
          ...baseValues,
          status: 'WP',
          payMode: result.payMode,
          providerOrderId: result.providerOrderId || null,
          providerStatus: result.providerStatus ?? null,
          qrImageUrl: result.qrImageUrl ?? null,
          qrContent: result.qrContent ?? null,
          payUrl: result.payUrl ?? null,
          notifyCount: 0,
          providerData: mergeProviderData(null, 'create', result.raw) as object | null
        })
      } catch (error) {
        const message = toErrorMessage(error, '发起支付失败')

        await orderRepo.insert({
          ...baseValues,
          status: 'FL',
          payMode: 'qrcode',
          failReason: truncateText(message, 500),
          notifyCount: 0,
          providerData: asJsonValue(error instanceof PayApiError ? error.raw : { message }) as object | null
        })

        throw new AppError('module.system.payOrder.createFailed', { message, cause: error })
      }

      return await getByIdOrThrow(id)
    },

    /**
     * 主动查询并推进本地状态（测试界面的「查询状态」与对账任务共用）。
     * 保护规则：已支付不回退；过期未支付则关闭为 CL。
     */
    async queryPayment(orderId: string, meta: PayOperatorMeta = {}): Promise<PayOrderRow> {
      const order = await getByIdOrThrow(orderId)
      const now = nowForMysql()

      if (isPaidStatus(order.status)) {
        await orderRepo.touchLastQuery(orderId, now, meta.operatorId ?? null)

        return await getByIdOrThrow(orderId)
      }

      // 节流：测试页轮询会周期性触发主动查询，这里保证对平台的调用不高于每 3 秒一次。
      // 命中节流时直接用本地快照返回，不请求平台。
      if (secondsSinceMysqlDateTime(order.lastQueryAt) < MIN_ACTIVE_QUERY_INTERVAL_SECONDS) {
        return order
      }

      const channel = await getPayChannelRuntimeById(db, order.channelId)
      const provider = getPayProvider(order.channelCode)
      if (!provider) {
        throw new AppError('module.system.payChannel.providerUnsupported', { message: order.channelCode })
      }

      const result = await provider.queryPayment(channel, {
        outTradeNo: order.outTradeNo,
        providerOrderId: order.providerOrderId
      })

      const updates: Record<string, unknown> = {
        lastQueryAt: now,
        updatedBy: meta.operatorId ?? null,
        providerStatus: result.providerStatus ?? order.providerStatus,
        providerOrderId: result.providerOrderId || order.providerOrderId,
        transactionId: result.transactionId || order.transactionId,
        providerData: mergeProviderData(order.providerData, 'lastQuery', result.raw) as object | null
      }

      let statusChanged = false

      if (canApplyStatusChange(order.status, result.status)) {
        updates.status = result.status
        statusChanged = true

        if (result.status === 'OD') {
          updates.paidAt = result.paidAt || now
        }
        if (result.status === 'CD') {
          updates.cancelledAt = now
        }
      } else if (order.status === 'WP' && isExpired(order.expireAt, now)) {
        updates.status = 'CL'
        updates.cancelledAt = now
        statusChanged = true
      }

      await orderRepo.updateById(orderId, updates)

      // 只有状态真正变化时才写日志，避免轮询把日志表刷满
      if (statusChanged) {
        try {
          await logRepo.insert({
            id: randomUuid(),
            channelId: order.channelId,
            channelCode: order.channelCode,
            orderId: order.id,
            outTradeNo: order.outTradeNo,
            providerOrderId: (updates.providerOrderId as string | null) ?? null,
            transactionId: (updates.transactionId as string | null) ?? null,
            amount: order.amount,
            currency: order.currency,
            providerStatus: result.providerStatus ?? null,
            status: (updates.status as string | null) ?? null,
            source: 'query',
            dedupKey: null,
            signValid: 0,
            processResult: 'success',
            message: truncateText(`主动查询：${order.status} → ${String(updates.status)}`, 500),
            rawBody: truncateText(JSON.stringify(result.raw ?? null), 60000),
            clientIp: meta.clientIp ?? null,
            userAgent: truncateText(meta.userAgent, 255),
            createdBy: meta.operatorId ?? null
          })
        } catch {
          // 查询日志写入失败不能影响状态推进，这里直接忽略
        }
      }

      return await getByIdOrThrow(orderId)
    },

    /** 本地关闭：仅未支付订单可关闭（虎皮椒等平台无取消接口，因此只改本地状态） */
    async closePayment(orderId: string, meta: PayOperatorMeta = {}): Promise<PayOrderRow> {
      const order = await getByIdOrThrow(orderId)

      if (!isClosableStatus(order.status)) {
        throw new AppError('module.system.payOrder.notClosable')
      }

      await orderRepo.updateById(orderId, {
        status: 'CL',
        cancelledAt: nowForMysql(),
        updatedBy: meta.operatorId ?? null
      })

      return await getByIdOrThrow(orderId)
    },

    /** 过期未支付订单列表（对账任务备用） */
    async listExpiredPending(limit = 50): Promise<PayOrderRow[]> {
      return await orderRepo.listExpiredPending(nowForMysql(), limit)
    }
  }
}

export type PayOrderService = ReturnType<typeof payOrderService>
