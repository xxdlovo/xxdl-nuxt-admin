/**
 * 会员领域层的类型契约。
 */
import type { CouponScene, CouponType } from '../wallet/types'

/** 会员来源：密码注册 / 第三方首登 */
export type MemberOnboardSource = 'register' | 'oauth'

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
