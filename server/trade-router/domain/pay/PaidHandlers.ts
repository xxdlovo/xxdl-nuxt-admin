/**
 * 支付成功后的业务分派（**唯一入口**）。
 *
 * 为什么要有这一层：支付单只有 `biz_type` 一个字段能把「这笔钱是干什么的」告诉业务方。
 * 之前回调里内联判断 `bizType === 'recharge'`，加入交易订单后如果继续内联，
 * 每接一个业务都要改回调路由。这里收口成一处：
 *
 * - `recharge` → 会员充值到账（`RechargeService.credit`，幂等）
 * - `order`    → 交易订单完成（`OrderService.markPaid`，幂等，不动余额）
 * - 其它（含 `test`）→ 保持原有 no-op：只把支付单置为已支付，不做业务后置
 *
 * 调用方：**只有**支付回调路由（`server/api/pay/notify/[channel].post.ts`）通过
 * `PayNotifyDispatcher` 的 `onPaid` 扩展点调用它。
 * 主动同步（`OrderService.sync` / `SysMemberService.myRechargeSync`）不经过这里：
 * 它们各自直接调业务侧幂等方法，因为此时已知业务类型、不必再按 `biz_type` 分派。
 *
 * 抛错表示后置处理失败：回调会返回 5xx，平台重试时会再次调用本函数（至少一次语义），
 * 业务侧靠唯一键与状态机保证同一事件只生效一次。
 */
import type { AppDb } from '#server/drizzle/db'
import { orderService } from '../order/OrderService'
import { rechargeService } from '../wallet/RechargeService'
import type { PayOrderRow } from './types'

/** 业务类型常量：与写入 sys_pay_order.biz_type 的值保持一致 */
export const PAY_BIZ_TYPE_RECHARGE = 'recharge'
export const PAY_BIZ_TYPE_ORDER = 'order'

export async function dispatchPaidOrder(order: PayOrderRow, db: AppDb): Promise<void> {
  if (order.bizType === PAY_BIZ_TYPE_RECHARGE) {
    await rechargeService(db).credit(order.outTradeNo, null)

    return
  }

  if (order.bizType === PAY_BIZ_TYPE_ORDER) {
    await orderService(db).markPaid(order.outTradeNo, null)

    return
  }

  // 未知业务类型：不抛错，保持「只标记支付成功」的历史行为（支付测试单依赖这一点）
}
