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
    placeholder: 'module.system.payChannel.field.gatewayPlaceholder',
    help: 'module.system.payChannel.field.gatewayHelp'
  }
]

const configSchema = z.object({
  appid: z.string().min(1),
  secret: z.string().min(1),
  gateway: z.string().min(1).default(DEFAULT_GATEWAY)
})

/**
 * 网关地址归一化。
 *
 * 虎皮椒后台上「我的支付渠道」显示的是完整接口地址（例如
 * https://api.dpweixin.com/payment/do.html），很容易被整段粘进 gateway 配置项，
 * 那样会拼成 .../payment/do.html/payment/query.html 而 404。
 * 这里统一剥掉接口路径，只保留 scheme://host[:port]（以及可能的自定义前缀）。
 */
export function normalizeXunhuPayGateway(input?: string | null) {
  const raw = (input ?? '').trim().replace(/\/+$/, '')

  if (!raw) {
    return DEFAULT_GATEWAY
  }

  // 容忍漏写协议（api.dpweixin.com）
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  const stripped = withScheme
    .replace(/\/payment\/(do|query|refund)\.html$/i, '')
    .replace(/\/payment$/i, '')

  try {
    const url = new URL(stripped)
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return stripped
  }
}

function readConfig(channel: PayChannelRuntime) {
  const parsed = configSchema.safeParse(channel.config ?? {})

  if (!parsed.success) {
    throw new AppError('module.system.payChannel.configInvalid', {
      message: parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    })
  }

  const rawGateway = parsed.data.gateway || DEFAULT_GATEWAY
  // 容忍把「我的支付渠道」里的完整接口地址（.../payment/do.html）整段粘进 gateway
  const gateway = normalizeXunhuPayGateway(rawGateway)

  return {
    appid: parsed.data.appid,
    secret: parsed.data.secret,
    gateway
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
      throw new PayApiError(`[xunhupay] HTTP ${response.status}（${url}）：${text.slice(0, 200)}`, text, response.status)
    }

    try {
      return JSON.parse(text) as Record<string, any>
    } catch {
      throw new PayApiError(`[xunhupay] 响应不是合法 JSON（${url}）：${text.slice(0, 200)}`, text)
    }
  } catch (error) {
    if (error instanceof PayApiError) {
      throw error
    }

    const message = error instanceof Error ? error.message : '网络请求失败'
    throw new PayApiError(`[xunhupay] ${message}（${url}）`, error)
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

/**
 * 取响应字段：兼容虎皮椒的两种结构。
 *
 * A) 官方文档形态：{ errcode, errmsg, hash, data: { url, url_qrcode, open_order_id } }
 * B) 实测形态（支付宝渠道）：{ errcode: 0, errmsg: 'success!', openid, url_qrcode, url } —— 结果平铺在顶层，
 *    且平台单号键名是 `openid` 而不是 `open_order_id`。
 *
 * 所以统一按「data 优先、顶层兜底」+「候选键名」取值，避免换渠道/换网关就取不到字段。
 */
function pickResponseFields(result: Record<string, any>) {
  const nested = result?.data && typeof result.data === 'object'
    ? result.data as Record<string, any>
    : {}
  const sources = [nested, result]

  const pick = (...keys: string[]) => {
    for (const source of sources) {
      for (const key of keys) {
        const value = source?.[key]
        if (value !== undefined && value !== null && value !== '') {
          return value
        }
      }
    }
    return undefined
  }

  const amount = pick('total_fee', 'amount')
  const amountText = amount === undefined ? null : Number(amount)
  const safeAmount = amountText !== null && Number.isFinite(amountText) && amountText > 0
    ? amountText.toFixed(2)
    : null

  return {
    providerOrderId: pick('open_order_id', 'openid', 'openOrderId', 'order_id', 'orderId'),
    qrImageUrl: pick('url_qrcode', 'qr_image_url', 'qrcode', 'qr_code', 'qrCode'),
    payUrl: pick('url', 'pay_url', 'payUrl'),
    providerStatus: pick('status', 'trade_status', 'order_status', 'pay_status'),
    transactionId: pick('transaction_id', 'transactionId', 'trade_no'),
    tradeOrderId: pick('trade_order_id', 'out_trade_order'),
    amount: safeAmount
  }
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

    const fields = pickResponseFields(result)

    return {
      providerOrderId: fields.providerOrderId ? String(fields.providerOrderId) : '',
      payMode: 'qrcode',
      qrImageUrl: fields.qrImageUrl ? String(fields.qrImageUrl) : null,
      // 虎皮椒直接返回二维码图片地址，不需要本地渲染
      qrContent: null,
      payUrl: fields.payUrl ? String(fields.payUrl) : null,
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

    const fields = pickResponseFields(result)
    const providerStatus = String(fields.providerStatus ?? 'WP')

    return {
      status: mapProviderStatus(PROVIDER_CODE, providerStatus),
      providerStatus,
      providerOrderId: fields.providerOrderId ? String(fields.providerOrderId) : key.providerOrderId ?? null,
      transactionId: fields.transactionId ? String(fields.transactionId) : null,
      amount: fields.amount,
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

    const fields = pickResponseFields(body)
    const outTradeNo = String(fields.tradeOrderId ?? '')
    if (!outTradeNo) {
      throw new PaySignError('[xunhupay] 回调缺少 trade_order_id')
    }

    const providerStatus = String(fields.providerStatus ?? 'WP')
    const transactionId = fields.transactionId ? String(fields.transactionId) : null
    const providerOrderId = fields.providerOrderId ? String(fields.providerOrderId) : null

    // 幂等键：同一订单 + 同一状态 + 同一交易号视为同一事件。
    // 虎皮椒重试会重新生成 time/nonce_str，用报文摘要做键会导致去重失效。
    const dedupKey = [outTradeNo, providerStatus, transactionId ?? providerOrderId ?? ''].join(':')

    return {
      outTradeNo,
      providerOrderId,
      transactionId,
      status: mapProviderStatus(PROVIDER_CODE, providerStatus),
      providerStatus,
      amount: fields.amount,
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
    let config: { appid: string; secret: string; gateway: string }

    try {
      config = readConfig(channel)
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : '渠道凭据不完整' }
    }

    const { appid, secret, gateway } = config
    const queryUrl = `${gateway}/payment/query.html`

    try {
      const params: Record<string, unknown> = {
        appid,
        out_trade_order: `verify-${Date.now()}`,
        time: nowSeconds(),
        nonce_str: makeNonce()
      }
      params.hash = makeXunhuPaySign(params, secret)

      const result = await postJson(queryUrl, params)
      const errcode = result?.errcode
      const errmsg = String(result?.errmsg ?? '')

      // 实测：虎皮椒先校验 APPID（再校验签名/订单号），这三个结论可以直接采信
      if (errcode === 0) {
        return { success: true, message: '网关连通，签名与 APPID 校验通过' }
      }
      if (/签名|sign|hash/i.test(errmsg)) {
        return { success: false, message: `签名校验失败（SECRET 可能不正确）：${errmsg}` }
      }
      if (/appid|应用/i.test(errmsg)) {
        return { success: false, message: `APPID 无效（errcode=${errcode}）：${errmsg}` }
      }

      // 其余错误（例如订单不存在）说明请求已被受理，APPID 与签名都没有被拒绝
      return {
        success: true,
        message: `网关连通、APPID 与签名已被受理（errcode=${errcode}，${errmsg}）`
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '验证失败'
      return { success: false, message }
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
