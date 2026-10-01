/**
 * 各支付平台的原始状态 → 统一状态映射，以及状态流转保护规则。
 *
 * 未登记的平台状态一律降级为 WP（待支付），避免把未知状态误判成已支付。
 * 后续新增适配器时，在这里补一段映射即可，不需要改数据库。
 */
import type { UnifiedPayStatus } from './types'

const STATUS_TABLE: Record<string, Record<string, UnifiedPayStatus>> = {
  // 虎皮椒：OD 已支付 / WP 待付款 / CD 已取消
  xunhupay: {
    WP: 'WP',
    OD: 'OD',
    CD: 'CD'
  },
  // 内置联调渠道
  mock: {
    pending: 'WP',
    paid: 'OD',
    closed: 'CL'
  },
  // 预留：码支付
  codepay: {
    '0': 'WP',
    '1': 'OD'
  },
  // 预留：Stripe PaymentIntent
  stripe: {
    requires_payment_method: 'WP',
    requires_confirmation: 'WP',
    requires_action: 'WP',
    processing: 'WP',
    requires_capture: 'WP',
    succeeded: 'OD',
    canceled: 'CD'
  },
  // 预留：支付宝当面付
  alipay_f2f: {
    WAIT_BUYER_PAY: 'WP',
    TRADE_SUCCESS: 'OD',
    TRADE_FINISHED: 'OD',
    TRADE_CLOSED: 'CD'
  }
}

export function mapProviderStatus(channelCode: string, providerStatus?: string | null): UnifiedPayStatus {
  if (!providerStatus) {
    return 'WP'
  }

  const table = STATUS_TABLE[channelCode]
  if (!table) {
    return 'WP'
  }

  return table[providerStatus] ?? table[providerStatus.toUpperCase()] ?? 'WP'
}

/** OD 是终态：已支付不能因为一次过期查询被改回待支付 */
export function isPaidStatus(status?: string | null) {
  return status === 'OD'
}

/** 尚未支付的订单才允许被关闭 */
export function isClosableStatus(status?: string | null) {
  return status === 'WP'
}

/**
 * 是否允许把订单从 current 推进到 next。
 * 保护规则：
 * - 已支付（OD）永不回退；
 * - 已取消/已关闭的订单不接受迟到的「待支付」查询结果（避免状态抖动），
 *   但接受平台的支付成功事实（钱已到账）。
 */
export function canApplyStatusChange(current: string | null | undefined, next: UnifiedPayStatus) {
  if (current === next) {
    return false
  }

  if (isPaidStatus(current)) {
    return false
  }

  if (next === 'WP' && (current === 'CD' || current === 'CL')) {
    return false
  }

  return true
}

/** 本地过期判定：expire_at 与当前时间同为 'YYYY-MM-DD HH:mm:ss' 字符串，可直接比较 */
export function isExpired(expireAt?: string | null, now?: string) {
  if (!expireAt) {
    return false
  }

  const current = now ?? new Date().toISOString().slice(0, 19).replace('T', ' ')
  return expireAt < current
}

export const UNIFIED_PAY_STATUSES: UnifiedPayStatus[] = ['WP', 'OD', 'CD', 'CL', 'FL', 'RF']
