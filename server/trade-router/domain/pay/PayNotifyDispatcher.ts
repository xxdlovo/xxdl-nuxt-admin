/**
 * 统一回调处理：验签 → 定位渠道与订单 → 金额/币种核对 → 幂等更新 → 写日志 → 决定响应体。
 *
 * 真实回调（/api/pay/notify/{channel}）与本地模拟回调（测试界面）共用这里的实现，
 * 保证两条链路的行为完全一致。
 *
 * 数据访问全部走 repo/payOrderRepo、repo/payNotifyLogRepo（mapper 层），本文件只做业务判断。
 */
import { createHash } from 'node:crypto'
import { AppError } from '#server/utils/appError'
import type { AppExecutor } from '#server/drizzle/db'
import { randomUuid } from '#shared/utils/uuid'
import { buildEnvFallbackChannel, listEnabledChannelsByCode } from './PayChannelResolver'
import { getPayProvider } from './providers'
import { payNotifyLogRepo, type PayNotifyLogInsert } from './repo/payNotifyLogRepo'
import { payOrderRepo } from './repo/payOrderRepo'
import { canApplyStatusChange, isPaidStatus } from './statusMap'
import {
  PaySignError,
  type PayChannelRuntime,
  type PayNotifyInput,
  type PayNotifyResponse,
  type PayNotifyResult,
  type PayNotifySource,
  type PayOrderRow,
  type PayProcessResult
} from './types'
import { asJsonValue, isIpAllowed, mergeProviderData, nowForMysql, sameAmount, toErrorMessage, truncateText } from './utils'

export type PayNotifyMeta = {
  clientIp?: string | null
  userAgent?: string | null
  source?: PayNotifySource
}

export type PayNotifyOutcome = {
  processResult: PayProcessResult
  orderId: string | null
  response: PayNotifyResponse
}

/**
 * 回调处理的扩展点。
 *
 * `onPaid` 在两种情况下调用（**至少一次**语义，业务侧必须幂等）：
 * 1. 本单**首次**被置为已支付（`markPaidIfPending` 影响行数 > 0）之后；
 * 2. 回调进来时订单**已经是** `OD`（影响行数为 0），且本次事件还没写过成功日志 ——
 *    说明上一次置为已支付之后业务后置可能没做完（抛错、进程中断，或订单是由主动查询
 *    `queryPayment` 推进的、那条路径根本不做业务分派）。此时补做一次，业务侧靠
 *    唯一键 / 条件更新保证不会重复生效。
 *
 * 约定：
 * - 抛错会中断回调处理并让调用方返回 5xx，平台重试时会在上面第 2 种情况重新触发本回调，
 *   因此「平台重试」确实是业务后置的补偿路径之一；
 * - 业务侧仍必须幂等：同一业务事件重复告知只允许生效一次；
 * - 平台不再重试、或回调根本没到达时，由对账/补偿任务按
 *   「支付单已支付但业务单未完成」补齐（见 `doc/main/8.payment/7.integration.md`）。
 */
export type PayNotifyOptions = {
  onPaid?: (order: PayOrderRow) => Promise<void>
}

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function isDuplicateKeyError(error: unknown) {
  return Boolean(
    error
    && typeof error === 'object'
    && ((error as { code?: string }).code === 'ER_DUP_ENTRY'
      || (error as { errno?: number }).errno === 1062)
  )
}

function textResponse(statusCode: number, body: string): PayNotifyResponse {
  return { statusCode, contentType: 'text/plain; charset=utf-8', body }
}

export function payNotifyDispatcher(executor: AppExecutor, options: PayNotifyOptions = {}) {
  const orderRepo = payOrderRepo(executor)
  const logRepo = payNotifyLogRepo(executor)

  type LogInsert = PayNotifyLogInsert

  /** 日志失败不能影响回调响应，否则平台会一直重试；重复键（幂等命中）属于预期，静默忽略 */
  async function writeLog(values: LogInsert) {
    try {
      await logRepo.insert(values)
    } catch {
      // 忽略：写入失败不影响回调处理结果
    }
  }

  function baseLog(
    input: PayNotifyInput,
    meta: PayNotifyMeta,
    source: PayNotifySource
  ): Omit<LogInsert, 'id' | 'channelCode' | 'outTradeNo' | 'processResult'> {
    return {
      channelId: null,
      orderId: null,
      providerOrderId: null,
      transactionId: null,
      amount: null,
      currency: null,
      providerStatus: null,
      status: null,
      source,
      dedupKey: null,
      signValid: 0,
      message: null,
      rawBody: truncateText(input.rawBody, 60000),
      rawHeaders: asJsonValue(input.headers) as object | null,
      clientIp: meta.clientIp ?? null,
      userAgent: truncateText(meta.userAgent, 255),
      createdBy: null
    }
  }

  /**
   * 逐个候选渠道验签（同一 channelCode 允许多个账户配置），第一个通过者即为来源渠道。
   * 缺少渠道配置时回退到环境变量渠道。
   */
  async function verifyAgainstChannels(channelCode: string, input: PayNotifyInput) {
    const candidates: PayChannelRuntime[] = await listEnabledChannelsByCode(executor, channelCode)

    if (candidates.length === 0) {
      const fallback = buildEnvFallbackChannel()
      if (fallback && fallback.channelCode === channelCode) {
        candidates.push(fallback)
      }
    }

    for (const channel of candidates) {
      const provider = getPayProvider(channel.channelCode)
      if (!provider) {
        continue
      }

      try {
        const result = await provider.verifyAndParseNotify(channel, input)
        return { channel, provider, result }
      } catch (error) {
        if (error instanceof PaySignError) {
          continue
        }
        throw error
      }
    }

    return null
  }

  async function handleNotify(
    channelCode: string,
    input: PayNotifyInput,
    meta: PayNotifyMeta = {}
  ): Promise<PayNotifyOutcome> {
    const source = meta.source ?? 'notify'
    const normalizedCode = channelCode.trim().toLowerCase()
    const logBase = baseLog(input, meta, source)

    let verified: Awaited<ReturnType<typeof verifyAgainstChannels>> = null

    try {
      verified = await verifyAgainstChannels(normalizedCode, input)
    } catch (error) {
      const message = toErrorMessage(error, '回调处理异常')
      await writeLog({
        ...logBase,
        id: randomUuid(),
        channelCode: normalizedCode,
        outTradeNo: '',
        processResult: 'error',
        message: truncateText(message, 500)
      })
      return { processResult: 'error', orderId: null, response: textResponse(500, 'error') }
    }

    if (!verified) {
      // 签名不匹配的报文用摘要做去重键，避免被伪造请求刷爆日志表
      await writeLog({
        ...logBase,
        id: randomUuid(),
        channelCode: normalizedCode,
        outTradeNo: '',
        processResult: 'invalid_sign',
        signValid: 0,
        dedupKey: `invalid:${sha256(input.rawBody)}`,
        message: '签名校验未通过'
      })

      return { processResult: 'invalid_sign', orderId: null, response: textResponse(400, 'invalid sign') }
    }

    const { channel, provider, result } = verified
    const resultLog: LogInsert = {
      id: randomUuid(),
      channelId: channel.id,
      channelCode: channel.channelCode,
      outTradeNo: result.outTradeNo,
      providerOrderId: result.providerOrderId ?? null,
      transactionId: result.transactionId ?? null,
      amount: result.amount ?? null,
      currency: result.currency ?? channel.currency ?? null,
      providerStatus: result.providerStatus ?? null,
      status: result.status,
      source,
      dedupKey: null,
      signValid: 1,
      processResult: 'success',
      message: null,
      rawBody: logBase.rawBody,
      rawHeaders: logBase.rawHeaders,
      clientIp: logBase.clientIp,
      userAgent: logBase.userAgent,
      createdBy: null
    }

    // 1) IP 白名单（验签通过后再校验，作为额外加固）
    if (!isIpAllowed(meta.clientIp, channel.ipAllowlist)) {
      await writeLog({
        ...resultLog,
        processResult: 'ip_blocked',
        message: truncateText(`来源 IP ${meta.clientIp ?? 'unknown'} 不在渠道白名单内`, 500)
      })

      return { processResult: 'ip_blocked', orderId: null, response: textResponse(403, 'ip blocked') }
    }

    // 2) 订单必须存在，否则只记日志（订单稍后创建由主动查询补齐）
    const order = await orderRepo.findByOutTradeNo(result.outTradeNo)

    if (!order) {
      await writeLog({
        ...resultLog,
        processResult: 'order_not_found',
        message: '本地未找到该商户订单号'
      })

      return {
        processResult: 'order_not_found',
        orderId: null,
        response: provider.buildNotifyResponse(result, true)
      }
    }

    resultLog.orderId = order.id
    resultLog.channelId = order.channelId ?? resultLog.channelId

    // 3) 金额与币种核对：不一致绝不改单
    const amountMatched = result.amount === null || result.amount === undefined
      ? true
      : sameAmount(result.amount, order.amount)
    const currencyMatched = !result.currency || result.currency === order.currency

    if (!amountMatched || !currencyMatched) {
      await writeLog({
        ...resultLog,
        processResult: 'amount_mismatch',
        message: truncateText(
          `金额/币种不一致：通知 ${result.amount ?? '-'} ${result.currency ?? '-'}，订单 ${order.amount} ${order.currency}`,
          500
        )
      })

      return {
        processResult: 'amount_mismatch',
        orderId: order.id,
        response: provider.buildNotifyResponse(result, true)
      }
    }

    const now = nowForMysql()

    // 4) 支付成功：条件更新保证并发/重复回调只生效一次
    if (result.status === 'OD') {
      const previousStatus = order.status

      if (await logRepo.existsByDedupKey(result.dedupKey)) {
        await orderRepo.applyNotifyCountUpdate(order.id, { lastNotifyAt: now })
        await writeLog({
          ...resultLog,
          status: previousStatus,
          processResult: 'duplicate',
          message: '该事件已处理过（幂等键命中）'
        })

        return {
          processResult: 'duplicate',
          orderId: order.id,
          response: provider.buildNotifyResponse(result, true)
        }
      }

      const affected = await orderRepo.markPaidIfPending(order.id, {
        paidAt: result.paidAt || now,
        lastNotifyAt: now,
        providerStatus: result.providerStatus ?? null,
        providerOrderId: result.providerOrderId || order.providerOrderId,
        transactionId: result.transactionId || order.transactionId,
        providerData: mergeProviderData(order.providerData, 'lastNotify', result.raw)
      })

      if (affected === 0) {
        /**
         * 订单已经是已支付：可能是渠道重复投递（业务后置早已完成），
         * 也可能是「上次置为已支付后业务后置失败 / 订单由主动查询推进」而本次事件没有日志。
         * 无法区分，因此这里**再告知业务域一次**（至少一次语义，业务侧幂等）：
         * 已完成时各业务侧会命中自己的唯一键 / 状态守卫，开销只是一次读。
         *
         * 注意：上面的 `existsByDedupKey` 命中分支不重复调用 —— 成功日志是在 `onPaid`
         * 之后写的，日志存在即可推断业务后置已完成。
         */
        if (options.onPaid) {
          const latestOrder = await orderRepo.findById(order.id) ?? order

          await options.onPaid(latestOrder)
        }

        await writeLog({
          ...resultLog,
          status: previousStatus,
          processResult: 'duplicate',
          message: '订单已是已支付状态，本次回调仅计数'
        })

        return {
          processResult: 'duplicate',
          orderId: order.id,
          response: provider.buildNotifyResponse(result, true)
        }
      }

      const processResult: PayProcessResult = previousStatus === 'CD' || previousStatus === 'CL'
        ? 'status_mismatch'
        : 'success'

      // 首次置为已支付：把事实交给业务域（失败即抛出，让平台重试；业务侧靠幂等键保证不重复）
      if (options.onPaid) {
        const paidOrder = await orderRepo.findById(order.id) ?? order

        await options.onPaid(paidOrder)
      }

      try {
        await logRepo.insert({
          ...resultLog,
          dedupKey: result.dedupKey,
          processResult,
          message: processResult === 'status_mismatch'
            ? truncateText(`资金已到账，订单由 ${previousStatus} 置为已支付`, 500)
            : null
        })
      } catch (error) {
        // 幂等键冲突说明是并发/重复回调，补一条 duplicate 日志；其他写入失败一律忽略
        if (isDuplicateKeyError(error)) {
          await writeLog({
            ...resultLog,
            status: previousStatus,
            processResult: 'duplicate',
            message: '并发回调重复处理'
          })
        }
      }

      return {
        processResult,
        orderId: order.id,
        response: provider.buildNotifyResponse(result, true)
      }
    }

    // 5) 非支付成功通知：只同步平台状态，不改变资金结论
    const statusChange = canApplyStatusChange(order.status, result.status)

    await orderRepo.applyNotifyCountUpdate(order.id, {
      lastNotifyAt: now,
      providerStatus: result.providerStatus ?? order.providerStatus,
      ...(statusChange ? { status: result.status } : {}),
      ...(statusChange && result.status === 'CD' ? { cancelledAt: now } : {})
    })

    await writeLog(resultLog)

    return {
      processResult: 'success',
      orderId: order.id,
      response: provider.buildNotifyResponse(result, true)
    }
  }

  /** 本地模拟支付成功：用配置里的密钥现算签名，走与真实回调完全相同的处理链路 */
  async function simulatePaid(orderId: string, meta: PayNotifyMeta = {}): Promise<PayNotifyOutcome> {
    const order = await orderRepo.findById(orderId)

    if (!order) {
      throw new AppError('common.notExist')
    }

    if (order.bizType !== 'test') {
      throw new AppError('module.system.payTest.simulateOnlyTest')
    }

    if (isPaidStatus(order.status)) {
      throw new AppError('module.system.payTest.alreadyPaid')
    }

    const channel = await listEnabledChannelsByCodeForOrder(executor, order)

    if (!channel) {
      throw new AppError('module.system.payChannel.notConfigured')
    }

    const provider = getPayProvider(channel.channelCode)

    if (!provider) {
      throw new AppError('module.system.payChannel.providerUnsupported', { message: channel.channelCode })
    }

    if (!provider.buildSimulatedNotify) {
      throw new AppError('module.system.payTest.simulateUnsupported', { message: channel.channelCode })
    }

    const input = await provider.buildSimulatedNotify(channel, order)

    return await handleNotify(channel.channelCode, input, { ...meta, source: 'simulate' })
  }

  return { handleNotify, simulatePaid }
}

/** 模拟回调时定位订单所用渠道：优先订单上的渠道配置行 */
async function listEnabledChannelsByCodeForOrder(
  executor: AppExecutor,
  order: PayOrderRow
): Promise<PayChannelRuntime | null> {
  const channels = await listEnabledChannelsByCode(executor, order.channelCode)

  if (order.channelId) {
    const matched = channels.find(channel => channel.id === order.channelId)

    if (matched) {
      return matched
    }
  }

  if (channels[0]) {
    return channels[0]
  }

  const fallback = buildEnvFallbackChannel()
  if (fallback && fallback.channelCode === order.channelCode) {
    return fallback
  }

  return null
}

export type PayNotifyDispatcher = ReturnType<typeof payNotifyDispatcher>
export type { PayNotifyResult }
