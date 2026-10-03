/**
 * 订单域的统一契约。
 *
 * 两个维度分开：
 * - `OrderStatus`（WP/OD/CL/FL）只描述**资金**；
 * - `OrderFulfillStatus`（none/pending/delivered）只描述**履约**（服务类订单支付后待交付）。
 */
import type { PriceSource } from '../goods/types'

export type OrderStatus = 'WP' | 'OD' | 'CL' | 'FL'
export type OrderPayMode = 'balance' | 'online'
export type OrderFulfillStatus = 'none' | 'pending' | 'delivered'

/** 关闭来源：会员自助取消 / 后台关闭 / 超时任务关闭 */
export type OrderCancelSource = 'user' | 'admin' | 'timeout'

/** 支付成功来源：渠道回调 / 主动同步 */
export type OrderPaidSource = 'callback' | 'sync' | 'admin'

/**
 * 订单支付超时（分钟）。
 * 余额单的冻结单**不设过期**（ttlMinutes = 0），释放权只归订单侧，
 * 因此这里的超时是唯一的自动释放触发点（由 `order:expire-close` 任务执行）。
 */
export const ORDER_TTL_MINUTES = 15

/** 单次超时关闭扫描的上限，避免一次任务处理过多订单 */
export const ORDER_EXPIRE_BATCH_SIZE = 200

/** 下单入参 */
export type OrderCreateInput = {
  userId: string
  goodsId: string
  quantity: number
  payMode: OrderPayMode
  couponCode?: string | null
  contact?: string | null
  remark?: string | null
  /** 幂等键：前端每次提交生成 */
  requestId: string
  /** 当前请求 origin：渠道未配 notify_url 时用于推导回调地址 */
  origin?: string | null
  notifyUrl?: string | null
  operatorId?: string | null
}

/** 下单结果：余额单给冻结信息，在线单给二维码/支付链接 */
export type OrderCreateResult = {
  orderId: string
  orderNo: string
  status: OrderStatus
  payMode: OrderPayMode
  fulfillStatus: OrderFulfillStatus
  unitPrice: string
  priceSource: PriceSource
  quantity: number
  totalAmount: string
  discountAmount: string
  payAmount: string
  giftAmount: string
  rechargeAmount: string
  freezeId: string | null
  payOrderId: string | null
  qrImageUrl: string | null
  qrContent: string | null
  payUrl: string | null
  expireAt: string | null
  /** true = 命中幂等键（重复提交），前端应提示「订单已存在」 */
  reused: boolean
}

/** 确认 / 完成 / 关闭的统一返回 */
export type OrderSettleResult = {
  orderId: string
  orderNo: string
  status: OrderStatus
  fulfillStatus: OrderFulfillStatus
  giftAmount: string
  rechargeAmount: string
  reused: boolean
}

/** 看板统计 */
export type OrderSummary = {
  totalCount: number
  totalAmount: string
  pendingCount: number
  pendingFulfillCount: number
  todayCount: number
  todayAmount: string
}

/** 超时关闭结果 */
export type OrderExpireCloseResult = {
  scanned: number
  closedCount: number
  failures: Array<{ orderNo: string, message: string }>
}

/** 在线支付同步结果 */
export type OrderSyncResult = {
  orderNo: string
  status: OrderStatus
  payOrderStatus: string | null
  changed: boolean
}
