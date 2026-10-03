/**
 * 会员 / 余额领域层的统一契约。
 *
 * 设计目标：业务侧只依赖本文件里的类型，不感知具体表结构与 SQL 细节。
 * 所有金额对外都是「元 + 两位小数字符串」，内部控制以「分」做整数运算（见 utils.ts）。
 */

/** 余额账户：双账模型 */
export type WalletAccount = 'recharge' | 'gift'

/** 资金方向 */
export type WalletDirection = 'in' | 'out'

/**
 * 流水业务类型（对应 sys_member_balance_log.biz_type）。
 *
 * **只登记「真实余额变动」**，预扣/释放属于预扣状态而不是余额变动，记录在
 * `sys_member_freeze` 的状态机与时间戳里，因此不写流水。这样对账公式保持干净：
 * `余额 = Σ(in) − Σ(out)`。
 *
 * - recharge          充值到账
 * - register_bonus    注册赠金
 * - gift_system       系统赠送
 * - gift_campaign     活动赠送
 * - adjust            手工调账（加/减）
 * - consume_confirm   业务消费确认实扣（预扣被真正扣掉的那一刻）
 * - gift_expire       赠送金过期扣减
 */
export type WalletBizType =
  | 'recharge'
  | 'register_bonus'
  | 'gift_system'
  | 'gift_campaign'
  | 'adjust'
  | 'consume_confirm'
  | 'gift_expire'

/** 赠送金来源 */
export type GiftSource = 'register' | 'system' | 'campaign'

/** 赠送金批次状态 */
export type GiftGrantStatus = 'active' | 'used' | 'expired'

/** 消费冻结单状态 */
export type FreezeStatus = 'FROZEN' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED'

/** 充值单状态：与支付单状态语义一致 */
export type RechargeStatus = 'WP' | 'OD' | 'CL' | 'FL'

/** 优惠码类型：固定金额 / 折扣率 */
export type CouponType = 'amount' | 'rate'

/** 优惠码适用场景 */
export type CouponScene = 'recharge' | 'consume' | 'all'

/** 优惠码使用记录状态 */
export type CouponUseStatus = 'locked' | 'used' | 'released'

/** 钱包快照（含可用余额计算结果，供 UI 直接展示） */
export type WalletSnapshot = {
  id: string
  userId: string
  currency: string
  rechargeBalance: string
  giftBalance: string
  frozenRecharge: string
  frozenGift: string
  /** 可用充值金 = recharge_balance - frozen_recharge */
  availableRecharge: string
  /** 可用赠送金 = gift_balance - frozen_gift */
  availableGift: string
  /** 可用总额 */
  availableTotal: string
  totalRecharge: string
  totalGift: string
  totalConsume: string
  status: number | null
}

/** 冻结结果：告知调用方本次预扣拆分了哪些账户 */
export type FreezeResult = {
  freezeId: string
  bizNo: string
  amount: string
  giftAmount: string
  rechargeAmount: string
  status: FreezeStatus
  expireAt: string | null
  /** 幂等命中（该 bizNo 之前已冻结过）时为 true，调用方据此提示「请勿重复提交」 */
  reused: boolean
}

/** 确认 / 释放结果 */
export type FreezeSettleResult = {
  freezeId: string
  bizNo: string
  status: FreezeStatus
  /** 本次实际扣减（确认）或释放的金额 */
  giftAmount: string
  rechargeAmount: string
  /** 已经是目标状态（幂等命中）时为 true */
  reused: boolean
}

/** 入账（增加余额）入参 */
export type WalletCreditInput = {
  userId: string
  account: WalletAccount
  amount: string | number
  bizType: WalletBizType
  /** 业务单号：与 bizType 一起构成幂等键 */
  bizNo: string
  /** 赠送金的过期时间（仅 account='gift' 时有意义，空表示永久有效） */
  giftExpireAt?: string | null
  giftSource?: GiftSource
  operatorId?: string | null
  reason?: string | null
  remark?: string | null
}

/** 记账（写流水 + 改余额）的统一入参，供 credit / freeze / confirm 复用 */
export type WalletLedgerInput = {
  userId: string
  account: WalletAccount
  direction: WalletDirection
  amountCents: number
  bizType: WalletBizType
  bizNo: string
  operatorId?: string | null
  reason?: string | null
  remark?: string | null
}

/** 对账结果中的一条不一致记录（**按账户**逐条给出，避免两账户对冲被掩盖） */
export type ReconcileMismatch = {
  userId: string
  /** 不一致的账户：recharge 充值金 / gift 赠送金 */
  account: WalletAccount
  /** 该账户的钱包余额 */
  walletTotal: string
  /** 该账户的流水净额 */
  ledgerTotal: string
  diff: string
}

/** 优惠码校验结果 */
export type CouponResolveResult = {
  couponId: string
  code: string
  type: CouponType
  /** 券面配置值：amount 类型是抵扣金额，rate 类型是应付比例（0.90 = 九折） */
  value: string
  /** 使用门槛（元，两位小数），0 表示无门槛 */
  minAmount: string
  /** 抵扣金额（元，两位小数） */
  discountAmount: string
  /** 附带赠送金（元，两位小数） */
  giftAmount: string
  /** 实际参与计算的订单金额（抵扣后） */
  payableAmount: string
}
