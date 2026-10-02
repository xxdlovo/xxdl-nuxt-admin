/**
 * 内置联调渠道（mock）。
 *
 * 用途：虎皮椒的 notify_url 必须是公网可访问地址，本地开发收不到异步回调，
 * mock 渠道提供「下单 → 本地模拟支付成功 → 幂等/金额校验全链路」的离线验证能力。
 *
 * 安全约束：
 * - 仅在 NUXT_PAY_MOCK_ENABLED=true，或非生产环境且未显式设置为 false 时注册；
 * - 依赖调用方生成的签名，签名算法与真实渠道保持一致的做法（HMAC-SHA256）。
 */
import { createHmac, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { AppError } from '#server/utils/appError'
import { mapProviderStatus } from '../statusMap'
import {
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

const PROVIDER_CODE = 'mock'

const FIELDS: PayProviderField[] = [
  {
    key: 'merchant_id',
    label: 'module.system.payChannel.field.merchantId',
    type: 'text',
    required: true,
    placeholder: 'module.system.payChannel.field.merchantIdPlaceholder'
  },
  {
    key: 'sign_key',
    label: 'module.system.payChannel.field.signKey',
    type: 'password',
    required: true,
    secret: true,
    placeholder: 'module.system.payChannel.field.signKeyPlaceholder'
  }
]

const configSchema = z.object({
  merchant_id: z.string().min(1),
  sign_key: z.string().min(1)
})

function readConfig(channel: PayChannelRuntime) {
  const parsed = configSchema.safeParse(channel.config ?? {})

  if (!parsed.success) {
    throw new AppError('module.system.payChannel.configInvalid', {
      message: parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    })
  }

  return parsed.data
}

/** 与真实渠道一致的签名思路：按 key 升序拼 key=value&...，再用 HMAC-SHA256 */
export function makeMockSign(params: Record<string, unknown>, signKey: string) {
  const filtered: Record<string, string> = {}

  for (const [key, value] of Object.entries(params)) {
    if (key === 'sign' || value === undefined || value === null || value === '') {
      continue
    }
    filtered[key] = String(value)
  }

  const query = Object.keys(filtered)
    .sort()
    .map(key => `${key}=${filtered[key]}`)
    .join('&')

  return createHmac('sha256', signKey).update(query, 'utf8').digest('hex')
}

function makeNonce() {
  return randomBytes(8).toString('hex')
}

export const mockPayProvider: PayProvider = {
  code: PROVIDER_CODE,
  name: '内置模拟支付',
  capabilities: {
    qrcode: true,
    redirect: false,
    jsapi: false,
    refund: false,
    query: true,
    sandbox: true,
    localQrRender: true
  },
  fields: FIELDS,
  configSchema,

  async createPayment(channel: PayChannelRuntime, input: PayCreateInput): Promise<PayCreateResult> {
    const { merchant_id, sign_key } = readConfig(channel)
    const providerOrderId = `MOCK-${input.outTradeNo}`
    const sign = makeMockSign({
      out_trade_no: input.outTradeNo,
      amount: input.amount,
      merchant_id
    }, sign_key)

    // 零依赖环境下不本地渲染二维码，给出的是一段可复制的支付内容
    const qrContent = `mockpay://pay?out_trade_no=${encodeURIComponent(input.outTradeNo)}`
      + `&amount=${encodeURIComponent(input.amount)}`
      + `&merchant_id=${encodeURIComponent(merchant_id)}`
      + `&sign=${sign}`

    return {
      providerOrderId,
      payMode: 'qrcode',
      qrImageUrl: null,
      qrContent,
      payUrl: null,
      providerStatus: 'pending',
      raw: {
        providerOrderId,
        outTradeNo: input.outTradeNo,
        amount: input.amount,
        qrContent,
        sign
      }
    }
  },

  async queryPayment(): Promise<PayQueryResult> {
    // mock 渠道没有远端状态存储：这里始终返回「待支付」。
    // 已支付订单不会被降级，由 statusMap.canApplyStatusChange 统一保护。
    return {
      status: 'WP',
      providerStatus: 'pending',
      raw: { message: 'mock provider keeps no remote state' }
    }
  },

  async verifyAndParseNotify(channel: PayChannelRuntime, input: PayNotifyInput): Promise<PayNotifyResult> {
    const { sign_key } = readConfig(channel)
    const body = input.body ?? {}
    const received = String(body.sign ?? '')

    if (!received) {
      throw new PaySignError('[mock] 回调缺少 sign')
    }

    const expected = makeMockSign(body, sign_key)

    if (received !== expected) {
      throw new PaySignError('[mock] 回调签名校验失败')
    }

    const outTradeNo = String(body.out_trade_no ?? '')
    if (!outTradeNo) {
      throw new PaySignError('[mock] 回调缺少 out_trade_no')
    }

    const providerStatus = String(body.status ?? 'pending')
    const transactionId = body.transaction_id ? String(body.transaction_id) : null

    return {
      outTradeNo,
      providerOrderId: body.provider_order_id ? String(body.provider_order_id) : null,
      transactionId,
      status: mapProviderStatus(PROVIDER_CODE, providerStatus),
      providerStatus,
      amount: body.amount !== undefined && body.amount !== null ? String(body.amount) : null,
      currency: channel.currency || 'CNY',
      paidAt: null,
      dedupKey: [outTradeNo, providerStatus, transactionId ?? ''].join(':'),
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
      const config = readConfig(channel)
      return {
        success: true,
        message: `内置联调渠道可用（商户号 ${config.merchant_id}）`
      }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : '验证失败' }
    }
  },

  async buildSimulatedNotify(channel: PayChannelRuntime, order: PayOrderRow): Promise<PayNotifyInput> {
    const { sign_key } = readConfig(channel)
    const body: Record<string, unknown> = {
      out_trade_no: order.outTradeNo,
      amount: Number(order.amount).toFixed(2),
      status: 'paid',
      transaction_id: order.transactionId || `SIM${Date.now()}`,
      provider_order_id: order.providerOrderId || `MOCK-${order.outTradeNo}`,
      nonce_str: makeNonce()
    }

    body.sign = makeMockSign(body, sign_key)

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
