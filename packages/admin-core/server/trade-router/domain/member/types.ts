/**
 * 会员领域层的类型契约。
 */
import type { CouponScene, CouponType } from '../wallet/types'

/** 会员来源：密码注册 / 第三方首登 */
export type MemberOnboardSource = 'register' | 'oauth' | 'backfill'

/** 注册建档结果 */
export type MemberOnboardResult = {
  memberId: string
  userId: string
  inviteCode: string
  /** 是否本次新建（false = 已存在，幂等返回） */
  created: boolean
  /** 绑定的上级用户 ID */
  inviterId: string | null
  /** 本次发放的注册赠金（元，两位小数；'0.00' 表示未配置或已发放过） */
  bonusAmount: string
}

/** 优惠码核销上下文 */
export type CouponUseInput = {
  couponId: string
  couponCode: string
  userId: string
  scene: Exclude<CouponScene, 'all'>
  /** 业务单号：充值单号 */
  bizNo: string
  discountAmount: string
  giftAmount: string
}

/** 优惠码判定结果（内部用） */
export type CouponValidation = {
  ok: boolean
  /** 不可用原因（用于日志与前端提示） */
  reason?: string
  type?: CouponType
  value?: string
  minAmount?: string
  giftAmount?: string
  perUserLimit?: number
  usedCount?: number
  maxUse?: number
  /** 该用户已使用次数 */
  userUsedCount?: number
}

// ── 会员等级价格 / 期限 / 开通单（domain 内部契约） ────────────────────────────

/**
 * 等级来源（对应 `sys_member.level_source`）：
 * manual 后台手工指定 / open 新开通 / renew 续费 / upgrade 升级（含降级）/
 * default 注册默认分配 / auto_expire 到期降级。
 */
export type MemberLevelSource = 'manual' | 'open' | 'renew' | 'upgrade' | 'default' | 'auto_expire'

/**
 * 开通单支付方式：balance 余额 / online 在线 / free 免费等级（服务端写入）/
 * manual 后台手工调整等级与期限（服务端写入，不动钱，仅留开通流水）。
 */
export type LevelOrderPayMode = 'balance' | 'online' | 'free' | 'manual'

/** 开通单状态：WP 待支付 / OD 已生效 / CL 已关闭 / FL 失败 */
export type LevelOrderStatus = 'WP' | 'OD' | 'CL' | 'FL'

/** 等级生效结果：本单产生的等级有效期区间 + 回写的来源 */
export type LevelEffectResult = {
  levelId: string
  levelName: string
  /** 生效开始时间（写回 sys_member.level_start_at） */
  startAt: string
  /** 生效结束时间；null = 长期/不设期限 */
  endAt: string | null
  /** 回写的 level_source */
  levelSource: MemberLevelSource
}

/** 发起开通（购买/续费）入参 */
export type CreateLevelOrderInput = {
  userId: string
  levelId: string
  /**
   * 用户选择的支付方式；price = 0 时服务端忽略它并落 free。
   * `free` / `manual` 都是服务端内部取值（后者见 `recordManualTx`），用户永远不能传。
   */
  payMode: Exclude<LevelOrderPayMode, 'free' | 'manual'>
  /** 幂等键（前端每次提交生成）：余额支付用它做冻结业务号，重复提交复用原单 */
  requestId: string
  /** 当前请求 origin：渠道未配 notify_url 时用于推导回调地址 */
  origin?: string | null
  notifyUrl?: string | null
  operatorId?: string | null
}

/** 发起开通结果（透出给自助接口） */
export type CreateLevelOrderResult = {
  orderId: string
  outTradeNo: string
  status: LevelOrderStatus
  levelId: string
  levelName: string
  payMode: LevelOrderPayMode
  priceAmount: string
  payAmount: string
  /** 支付超时时间（在线支付才有） */
  expireAt: string | null
  /** 等级实际生效时间；未生效（待支付）时为 null */
  effectiveAt: string | null
  /** 本单产生的等级到期时间；null = 长期 */
  endAt: string | null
  qrImageUrl: string | null
  qrContent: string | null
  payUrl: string | null
  /** true = 命中幂等（重复提交），前端应提示「已存在开通单」 */
  reused: boolean
}

/** 支付成功生效结果（回调 / 主动同步共用） */
export type MarkLevelPaidResult = {
  orderId: string
  outTradeNo: string
  status: LevelOrderStatus
  levelId: string
  levelName: string
  /** true = 本单此前已生效，本次未重复顺延期限 */
  reused: boolean
  effectiveAt: string | null
  endAt: string | null
}

/** 开通单状态（只读本地库 / 主动同步后） */
export type LevelOrderStatusResult = {
  outTradeNo: string
  status: LevelOrderStatus
  failReason: string | null
  effectiveAt: string | null
  endAt: string | null
}

/** 等级到期降级任务结果（与 `order:expire-close` 的形态一致） */
export type ExpireLevelsResult = {
  scanned: number
  changedCount: number
  failures: Array<{ userId: string, message: string }>
}
