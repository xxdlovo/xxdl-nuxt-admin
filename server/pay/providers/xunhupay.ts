/**
 * 虎皮椒（xunhupay）适配器。
 *
 * 实现依据 doc/hpj/SKILL.md 与 doc/hpj/reference.md：
 * - 签名：过滤空值与 hash 字段 → 按参数名 ASCII 升序 → 拼 key=value&... → 末尾直接追加 secret → MD5 小写
 * - 发起支付：POST {gateway}/payment/do.html（JSON）
 * - 查询订单：POST {gateway}/payment/query.html（out_trade_order / open_order_id 二选一）
 * - 回调：application/x-www-form-urlencoded，必须验签，处理完返回纯文本 success
 *
 * 网关完全以渠道配置为准（虎皮椒后台的「我的支付渠道」显示的地址可能不是 api.xunhupay.com）。
 */
import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { AppError } from '#server/utils/appError'
import { mapProviderStatus } from '../statusMap'
import {
  PayApiError,
  PaySignError,
  type PayChannelRuntime,
  type PayCreateInput,
  type PayCreateResult,
  type PayNotifyInput,
  type PayNotifyResult,
  type PayNotifyResponse,
  type PayOrderRow,
  type PayProvider,
  type PayProviderField,
  type PayQueryResult,
  type PayVerifyResult
} from '../types'

const PROVIDER_CODE = 'xunhupay'
const DEFAULT_GATEWAY = 'https://api.xunhupay.com'
const REQUEST_TIMEOUT_MS = 10_000

const FIELDS: PayProviderField[] = [
  {
    key: 'appid',
    label: 'module.system.payChannel.field.appid',
    type: 'text',
    required: true,
    placeholder: 'module.system.payChannel.field.appidPlaceholder'
  },
  {
    key: 'secret',
    label: 'module.system.payChannel.field.secret',
    type: 'password',
    required: true,
    secret: true,
    placeholder: 'module.system.payChannel.field.secretPlaceholder'
  },
  {
    key: 'gateway',
    label: 'module.system.payChannel.field.gateway',
    type: 'text',
    defaultValue: DEFAULT_GATEWAY,
    help: 'module.system.payChannel.field.gatewayHelp'
  }
]

const configSchema = z.object({
  appid: z.string().min(1),
  secret: z.string().min(1),
  gateway: z.string().min(1).default(DEFAULT_GATEWAY)
})

function readConfig(channel: PayChannelRuntime) {
  const parsed = configSchema.safeParse(channel.config ?? {})

  if (!parsed.success) {
    throw new AppError('module.system.payChannel.configInvalid', {
      message: parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    })
  }

  return {
    appid: parsed.data.appid,
    secret: parsed.data.secret,
    gateway: (parsed.data.gateway || DEFAULT_GATEWAY).replace(/\/+$/, '')
  }
}

/** 虎皮椒签名算法：空值参数不参与签名，hash 字段本身不参与 */
export function makeXunhuPaySign(params: Record<string, unknown>, secret: string) {
  const filtered: Record<string, string> = {}

  for (const [key, value] of Object.entries(params)) {
    if (key === 'hash' || value === undefined || value === null || value === '') {
      continue
    }
    filtered[key] = String(value)
  }

  const query = Object.keys(filtered)
    .sort()
    .map(key => `${key}=${filtered[key]}`)
    .join('&')

  return createHash('md5').update(`${query}${secret}`, 'utf8').digest('hex')
}

function makeNonce() {
  return randomBytes(16).toString('hex')
}

function nowSeconds() {
  return String(Math.floor(Date.now() / 1000))
}

function formatAmount(input: string | number) {
  const value = Number(input)
  if (!Number.isFinite(value) || value <= 0) {
    throw new PayApiError('[xunhupay] 金额不合法')
  }
  return value.toFixed(2)
}

async function postJson(url: string, payload: Record<string, unknown>) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json;charset=UTF-8' },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    const text = await response.text()

    if (!response.ok) {
      throw new PayApiError(`[xunhupay] HTTP ${response.status}`, text, response.status)
    }

    try {
      return JSON.parse(text) as Record<string, any>
    } catch {
      throw new PayApiError('[xunhupay] 响应不是合法 JSON', text)
    }
  } catch (error) {
    if (error instanceof PayApiError) {
      throw error
    }
    const message = error instanceof Error ? error.message : '网络请求失败'
    throw new PayApiError(`[xunhupay] ${message}`, error)
  } finally {
    clearTimeout(timer)
  }
}

function assertErrcodeOk(result: Record<string, any>, action: string) {
  if (result?.errcode === 0) {
    return
  }

  const errmsg = result?.errmsg ?? '未知错误'
  throw new PayApiError(`[xunhupay] ${action}失败：${errmsg}`, result, result?.errcode)
}

export const xunhuPayProvider: PayProvider = {
  code: PROVIDER_CODE,
  name: '虎皮椒支付',
  capabilities: {
    qrcode: true,
    redirect: true,
    jsapi: false,
    refund: false,
    query: true,
    sandbox: false,
    localQrRender: false
  },
  fields: FIELDS,
  configSchema,

  async createPayment(channel: PayChannelRuntime, input: PayCreateInput): Promise<PayCreateResult> {
    const { appid, secret, gateway } = readConfig(channel)
    const params: Record<string, unknown> = {
      version: '1.1',
      appid,
      trade_order_id: input.outTradeNo,
      total_fee: formatAmount(input.amount),
      title: input.subject,
      notify_url: input.notifyUrl,
      time: nowSeconds(),
      nonce_str: makeNonce()
    }

    // 空值参数不参与签名，因此只在有值时写入
    if (input.returnUrl) {
      params.return_url = input.returnUrl
    }
    if (input.cancelUrl) {
      params.callback_url = input.cancelUrl
    }
    if (input.attach) {
      params.attach = input.attach
    }

    params.hash = makeXunhuPaySign(params, secret)

    const result = await postJson(`${gateway}/payment/do.html`, params)
    assertErrcodeOk(result, '发起支付')

    const data = result.data ?? {}

    return {
      providerOrderId: String(data.open_order_id ?? ''),
      payMode: 'qrcode',
      qrImageUrl: data.url_qrcode ? String(data.url_qrcode) : null,
      // 虎皮椒直接返回二维码图片地址，不需要本地渲染
      qrContent: null,
      payUrl: data.url ? String(data.url) : null,
      providerStatus: 'WP',
      raw: result
    }
  },

  async queryPayment(
    channel: PayChannelRuntime,
    key: { outTradeNo?: string | null; providerOrderId?: string | null }
  ): Promise<PayQueryResult> {
    const { appid, secret, gateway } = readConfig(channel)

    if (!key.outTradeNo && !key.providerOrderId) {
      throw new PayApiError('[xunhupay] 查询订单需要 out_trade_order 或 open_order_id')
    }

    const params: Record<string, unknown> = {
      appid,
      time: nowSeconds(),
      nonce_str: makeNonce()
    }

    if (key.outTradeNo) {
      params.out_trade_order = key.outTradeNo
    } else {
      params.open_order_id = key.providerOrderId
    }

    params.hash = makeXunhuPaySign(params, secret)

    const result = await postJson(`${gateway}/payment/query.html`, params)
    assertErrcodeOk(result, '查询订单')

    const data = result.data ?? {}
    const providerStatus = String(data.status ?? 'WP')

    return {
      status: mapProviderStatus(PROVIDER_CODE, providerStatus),
      providerStatus,
      providerOrderId: data.open_order_id ? String(data.open_order_id) : key.providerOrderId ?? null,
      transactionId: data.transaction_id ? String(data.transaction_id) : null,
      raw: result
    }
  },

  async verifyAndParseNotify(channel: PayChannelRuntime, input: PayNotifyInput): Promise<PayNotifyResult> {
    const { appid, secret } = readConfig(channel)
    const body = input.body ?? {}
    const received = String(body.hash ?? '')

    if (!received) {
      throw new PaySignError('[xunhupay] 回调缺少 hash')
    }

    const expected = makeXunhuPaySign(body, secret)

    if (received !== expected) {
      throw new PaySignError('[xunhupay] 回调签名校验失败')
    }

    if (body.appid && String(body.appid) !== appid) {
      throw new PaySignError('[xunhupay] 回调 appid 与渠道配置不一致')
    }

    const outTradeNo = String(body.trade_order_id ?? '')
    if (!outTradeNo) {
      throw new PaySignError('[xunhupay] 回调缺少 trade_order_id')
    }

    const providerStatus = String(body.status ?? 'WP')
    const transactionId = body.transaction_id ? String(body.transaction_id) : null
    const providerOrderId = body.open_order_id ? String(body.open_order_id) : null

    // 幂等键：同一订单 + 同一状态 + 同一交易号视为同一事件。
    // 虎皮椒重试会重新生成 time/nonce_str，用报文摘要做键会导致去重失效。
    const dedupKey = [outTradeNo, providerStatus, transactionId ?? providerOrderId ?? ''].join(':')

    return {
      outTradeNo,
      providerOrderId,
      transactionId,
      status: mapProviderStatus(PROVIDER_CODE, providerStatus),
      providerStatus,
      amount: body.total_fee !== undefined && body.total_fee !== null ? formatAmount(String(body.total_fee)) : null,
      currency: channel.currency || 'CNY',
      paidAt: null,
      dedupKey,
      raw: body
    }
  },

  buildNotifyResponse(_result: PayNotifyResult | null, ok: boolean): PayNotifyResponse {
    return {
      statusCode: ok ? 200 : 400,
      contentType: 'text/plain; charset=utf-8',
      body: ok ? 'success' : 'invalid sign'
    }
  },

  async verifyChannel(channel: PayChannelRuntime): Promise<PayVerifyResult> {
    try {
      const { appid, secret, gateway } = readConfig(channel)
      const params: Record<string, unknown> = {
        appid,
        out_trade_order: `verify-${Date.now()}`,
        time: nowSeconds(),
        nonce_str: makeNonce()
      }
      params.hash = makeXunhuPaySign(params, secret)

      const result = await postJson(`${gateway}/payment/query.html`, params)
      const errmsg = String(result?.errmsg ?? '')

      if (result?.errcode === 0) {
        return { success: true, message: '网关连通，签名与 APPID 校验通过' }
      }
      if (/签名|sign/i.test(errmsg)) {
        return { success: false, message: `签名校验失败：${errmsg}` }
      }
      if (/appid|应用/i.test(errmsg)) {
        return { success: false, message: `APPID 无效：${errmsg}` }
      }

      // 订单不存在属于预期结果，说明网关、APPID 与签名都已被受理
      return { success: true, message: `网关连通（测试订单不存在属预期）：${errmsg}` }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : '验证失败' }
    }
  },

  async buildSimulatedNotify(channel: PayChannelRuntime, order: PayOrderRow): Promise<PayNotifyInput> {
    const { appid, secret } = readConfig(channel)

    const body: Record<string, unknown> = {
      trade_order_id: order.outTradeNo,
      total_fee: formatAmount(order.amount),
      transaction_id: order.transactionId || `SIM${Date.now()}`,
      open_order_id: order.providerOrderId || `SIMOPEN${Date.now()}`,
      order_title: order.subject,
      status: 'OD',
      appid,
      time: nowSeconds(),
      nonce_str: makeNonce()
    }

    if (order.attach) {
      body.attach = order.attach
    }

    body.hash = makeXunhuPaySign(body, secret)

    const rawBody = new URLSearchParams(
      Object.entries(body).map(([key, value]) => [key, String(value)])
    ).toString()

    return {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      rawBody,
      body
    }
  }
}
