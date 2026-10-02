/**
 * 支付模块统一契约。
 *
 * 设计目标：业务侧只依赖本文件里的 DTO，不感知具体平台。
 * 新增一个支付平台 = 在 server/trade-router/domain/pay/providers/ 下实现 PayProvider + 在注册表登记一行，
 * 不需要改表结构、不需要改路由、不需要改前端页面。
 */
import type { ZodObject } from 'zod'
import type { sysPayOrder } from '#server/drizzle/schema'

/**
 * 统一支付状态。渠道原始状态经 statusMap 映射后落到 sys_pay_order.status。
 * - WP 待支付 / OD 已支付（终态）/ CD 已取消 / CL 已关闭 / FL 发起失败 / RF 已退款（预留）
 */
export type UnifiedPayStatus = 'WP' | 'OD' | 'CD' | 'CL' | 'FL' | 'RF'

/** 支付发起方式：qrcode 二维码 / redirect 跳转 / jsapi 公众号 / web 网页收银台 */
export type PayMode = 'qrcode' | 'redirect' | 'jsapi' | 'web'

/** 日志来源：notify 平台回调 / query 主动查询 / simulate 本地模拟 / reconcile 对账任务 */
export type PayNotifySource = 'notify' | 'query' | 'simulate' | 'reconcile'

/** 日志处理结论，与 sys_pay_notify_log.process_result 取值一一对应 */
export type PayProcessResult =
  | 'success'
  | 'duplicate'
  | 'invalid_sign'
  | 'order_not_found'
  | 'amount_mismatch'
  | 'status_mismatch'
  | 'ip_blocked'
  | 'error'

export type PayOrderRow = typeof sysPayOrder.$inferSelect

/** 已解密、可直接交给适配器使用的渠道运行时配置 */
export type PayChannelRuntime = {
  /** 渠道配置行 id；环境变量兜底时为 null */
  id: string | null
  configKey: string
  configName: string
  channelCode: string
  mode: string
  currency: string
  /** 已解密的渠道私有配置；结构由对应 provider.configSchema 约束 */
  config: Record<string, unknown>
  notifyUrl: string | null
  returnUrl: string | null
  cancelUrl: string | null
  orderTimeoutMinutes: number
  ipAllowlist: string | null
}

export type PayCreateInput = {
  outTradeNo: string
  /** 元，两位小数字符串 */
  amount: string
  currency: string
  subject: string
  body?: string | null
  notifyUrl: string
  returnUrl?: string | null
  cancelUrl?: string | null
  clientIp?: string | null
  attach?: string | null
  extra?: Record<string, unknown>
}

export type PayCreateResult = {
  providerOrderId: string
  payMode: PayMode
  /** 平台直接返回的二维码图片地址 */
  qrImageUrl?: string | null
  /** 需要本地渲染的二维码内容（零依赖时仅展示/复制） */
  qrContent?: string | null
  payUrl?: string | null
  providerStatus?: string | null
  raw: unknown
}

export type PayQueryResult = {
  status: UnifiedPayStatus
  providerStatus: string
  amount?: string | null
  currency?: string | null
  transactionId?: string | null
  providerOrderId?: string | null
  paidAt?: string | null
  raw: unknown
}

/**
 * 回调入参。rawBody 必须是原始报文（Stripe 等平台验签依赖原文），
 * body 是解析后的对象（表单或 JSON）。
 */
export type PayNotifyInput = {
  headers: Record<string, string>
  rawBody: string
  body: Record<string, unknown>
}

export type PayNotifyResult = {
  outTradeNo: string
  providerOrderId?: string | null
  transactionId?: string | null
  status: UnifiedPayStatus
  providerStatus: string
  amount?: string | null
  currency?: string | null
  paidAt?: string | null
  /** 平台事件幂等键；同一事件重复投递必须得到相同值 */
  dedupKey: string
  raw: unknown
}

export type PayNotifyResponse = {
  statusCode: number
  contentType: string
  body: string
}

export type PayVerifyResult = {
  success: boolean
  message: string
}

export type PayProviderCapabilities = {
  /** 支持返回二维码 */
  qrcode: boolean
  /** 支持跳转收银台 */
  redirect: boolean
  /** 支持公众号/小程序内支付 */
  jsapi: boolean
  /** 支持退款（本期均未实现，仅声明能力位） */
  refund: boolean
  /** 支持主动查询订单 */
  query: boolean
  /** 支持沙箱 */
  sandbox: boolean
  /** 是否需要本地渲染二维码内容 */
  localQrRender: boolean
}

/**
 * 渠道私有配置字段元数据。
 * 后端据此做字段级加解密与校验，前端据此渲染动态表单，两边共用同一份定义。
 * label 是 i18n key（module.system.payChannel.field.*）。
 */
export type PayProviderField = {
  key: string
  label: string
  type: 'text' | 'password' | 'number' | 'switch' | 'textarea'
  required?: boolean
  /** 标记为密钥：落库加密、接口掩码、编辑留空不覆盖 */
  secret?: boolean
  placeholder?: string
  help?: string
  defaultValue?: string | number | boolean
}

export type PayProviderMeta = {
  code: string
  name: string
  capabilities: PayProviderCapabilities
  fields: PayProviderField[]
}

export type PayProvider = {
  code: string
  name: string
  capabilities: PayProviderCapabilities
  /** 与 configSchema 保持同步：字段增删要同时改这两处 */
  fields: PayProviderField[]
  configSchema: ZodObject<any>
  createPayment: (channel: PayChannelRuntime, input: PayCreateInput) => Promise<PayCreateResult>
  queryPayment: (
    channel: PayChannelRuntime,
    key: { outTradeNo?: string | null; providerOrderId?: string | null }
  ) => Promise<PayQueryResult>
  closePayment?: (channel: PayChannelRuntime, order: PayOrderRow) => Promise<void>
  /** 必须内含验签；验签失败抛 PaySignError */
  verifyAndParseNotify: (channel: PayChannelRuntime, input: PayNotifyInput) => Promise<PayNotifyResult>
  /** 平台要求的响应体：虎皮椒/mock 为纯文本 success */
  buildNotifyResponse: (result: PayNotifyResult | null, ok: boolean) => PayNotifyResponse
  /** 「测试配置」按钮调用 */
  verifyChannel: (channel: PayChannelRuntime) => Promise<PayVerifyResult>
  /** 本地模拟回调所需报文；未实现表示该渠道不支持模拟 */
  buildSimulatedNotify?: (channel: PayChannelRuntime, order: PayOrderRow) => Promise<PayNotifyInput>
}

/** 验签失败：dispatcher 据此记为 invalid_sign 并返回 4xx，绝不返回 success */
export class PaySignError extends Error {
  constructor(message = 'invalid sign') {
    super(message)
    this.name = 'PaySignError'
  }
}

/** 渠道接口返回的业务错误（errcode != 0 / HTTP 异常 / 响应不可解析） */
export class PayApiError extends Error {
  constructor(
    message: string,
    public readonly raw?: unknown,
    public readonly code?: string | number
  ) {
    super(message)
    this.name = 'PayApiError'
  }
}
