/**
 * 支付模块公共工具：时间归一、金额归一、订单号生成、IP 白名单、JSON 兜底。
 *
 * 时间格式统一为 'YYYY-MM-DD HH:mm:ss'，与项目既有 Service 的写法保持一致
 * （见 server/sys-router/notice/SysNoticeService.ts），保证与 MySQL
 * CURRENT_TIMESTAMP / ON UPDATE 写入的值可直接按字符串比较。
 */
import { AppError } from '#server/utils/appError'

/**
 * 生成与 MySQL 同处一个时区的「本地墙钟时间」字符串。
 *
 * 不能用 toISOString()：它按 UTC 输出，而 sys_pay_order.created_at / updated_at
 * 由 MySQL 的 CURRENT_TIMESTAMP（会话时区，本机是 +08:00）写入，
 * 两者混用会让 paid_at / expire_at / last_query_at 比 created_at 整整差 8 小时。
 */
export function nowForMysql(date: Date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function toMysqlDateTime(date: Date) {
  return nowForMysql(date)
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

/**
 * 金额统一为「元 + 两位小数」字符串。
 * 上限 99999999.99 与 sys_pay_order.amount decimal(10,2) 对齐。
 */
export function normalizeAmount(input: string | number): string {
  const value = typeof input === 'number' ? input : Number(String(input ?? '').trim())
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError('module.system.payOrder.amountInvalid')
  }
  const fixed = value.toFixed(2)
  if (Number(fixed) > 99999999.99) {
    throw new AppError('module.system.payOrder.amountTooLarge')
  }
  return fixed
}

/** 金额比较前统一两位小数，避免 '9.9' 与 '9.90' 被判为不一致 */
export function sameAmount(a: string | number | null | undefined, b: string | number | null | undefined) {
  try {
    return normalizeAmount(a ?? '') === normalizeAmount(b ?? '')
  } catch {
    return false
  }
}

/**
 * 商户订单号：前缀 + yyyyMMddHHmmss + 6 位随机大写字母数字。
 * 唯一性最终由 uk_pay_order_out_trade_no 保证，冲突时由调用方重试。
 */
export function buildOutTradeNo(prefix = 'PAY') {
  const now = new Date()
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('')
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let suffix = ''
  for (let index = 0; index < 6; index += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `${prefix}${stamp}${suffix}`
}

/** 逗号/换行/空格分隔的 IP 白名单解析 */
export function parseIpAllowlist(value?: string | null): string[] {
  if (!value) {
    return []
  }
  return value
    .split(/[\s,，;；]+/)
    .map(item => item.trim())
    .filter(Boolean)
}

export function isIpAllowed(clientIp: string | null | undefined, allowlist?: string | null) {
  const list = parseIpAllowlist(allowlist)
  if (list.length === 0) {
    return true
  }
  if (!clientIp) {
    return false
  }
  return list.includes(clientIp)
}

/** 写 json 列时的兜底：undefined 统一落 null，避免 drizzle 写入被忽略 */
export function asJsonValue(value: unknown): unknown {
  if (value === undefined) {
    return null
  }
  return value
}

/**
 * provider_data 的累加写入。
 *
 * 不要再整体覆盖：下单原始响应一旦被回调/查询的报文覆盖，就再也看不到
 * 「平台到底返回了哪些字段」了（排查二维码/链接为空这类问题全靠它）。
 * 结构：{ create, lastQuery, lastNotify }
 */
export function mergeProviderData(
  existing: unknown,
  key: 'create' | 'lastQuery' | 'lastNotify',
  value: unknown
): Record<string, unknown> {
  const base = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? { ...(existing as Record<string, unknown>) }
    : {}

  return { ...base, [key]: asJsonValue(value) }
}

export function toErrorMessage(error: unknown, fallback = 'unknown error') {
  if (error instanceof Error) {
    return error.message || fallback
  }
  if (typeof error === 'string' && error) {
    return error
  }
  return fallback
}

/** 截断超长文本，避免超出 varchar(500) 之类的列宽 */
export function truncateText(value: unknown, maxLength = 500): string | null {
  if (value === undefined || value === null) {
    return null
  }
  const text = String(value)
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

/**
 * 距离某个 'YYYY-MM-DD HH:mm:ss'（本地墙钟，与 MySQL 写入格式一致）过去了多少秒。
 * 用于主动查询的节流；无法解析的值一律当作「很久以前」，不阻塞查询。
 */
export function secondsSinceMysqlDateTime(value?: string | null) {
  if (!value) {
    return Number.POSITIVE_INFINITY
  }

  const timestamp = new Date(String(value).replace(' ', 'T')).getTime()

  if (Number.isNaN(timestamp)) {
    return Number.POSITIVE_INFINITY
  }

  return (Date.now() - timestamp) / 1000
}

/** 本次下单实际使用的回调地址：渠道配置优先，其次按请求 origin 推导 */
export function resolveNotifyUrl(options: {
  override?: string | null
  configured?: string | null
  origin?: string | null
  channelCode: string
}) {
  const override = options.override?.trim()
  if (override) {
    return override
  }
  const configured = options.configured?.trim()
  if (configured) {
    return configured
  }
  const origin = options.origin?.trim()?.replace(/\/+$/, '')
  if (origin) {
    return `${origin}/api/pay/notify/${options.channelCode}`
  }
  return null
}
