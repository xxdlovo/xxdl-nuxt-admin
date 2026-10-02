/**
 * 会员 / 余额领域层的公共工具。
 *
 * 金额处理原则：**内部一律换算成「分」做整数加减**，只在出入参时转成
 * 「元 + 两位小数字符串」。这样不会出现 0.1 + 0.2 这类浮点误差，
 * 也避免在 SQL 里对 decimal 做隐式浮点运算。
 */
import { AppError } from '#server/utils/appError'
import type { WalletAccount, WalletBizType, WalletDirection } from './types'

/** 单笔金额上限（元），与 decimal(12,2) 对齐 */
export const MAX_AMOUNT = 9999999999.99

/** 把「元」转成整数分；非法值抛业务错误 */
export function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    throw new AppError('module.system.member.amountInvalid')
  }

  const text = typeof value === 'number' ? value.toFixed(2) : String(value).trim()
  const matched = /^-?\d+(\.\d{1,2})?$/.test(text)

  if (!matched) {
    throw new AppError('module.system.member.amountInvalid')
  }

  // 用字符串拆分换算，避免 parseFloat 的精度问题
  const negative = text.startsWith('-')
  const [intPart, decimalPart = ''] = text.replace('-', '').split('.')
  const cents = Number(intPart) * 100 + Number((decimalPart + '00').slice(0, 2))
  const result = negative ? -cents : cents

  if (!Number.isSafeInteger(result)) {
    throw new AppError('module.system.member.amountInvalid')
  }

  return result
}

/** 分 → 「元」两位小数字符串 */
export function fromCents(cents: number): string {
  const negative = cents < 0
  const abs = Math.abs(Math.round(cents))
  const text = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`

  return negative ? `-${text}` : text
}

/** 金额归一化 + 范围校验（正数必填时用 allowZero=false） */
export function normalizeMoney(
  value: string | number | null | undefined,
  options: { allowZero?: boolean } = {}
): string {
  const cents = toCents(value)

  if (cents < 0) {
    throw new AppError('module.system.member.amountInvalid')
  }
  if (cents === 0 && !options.allowZero) {
    throw new AppError('module.system.member.amountInvalid')
  }
  if (cents > toCents(MAX_AMOUNT)) {
    throw new AppError('module.system.member.amountTooLarge')
  }

  return fromCents(cents)
}

export function addMoney(a: string, b: string): string {
  return fromCents(toCents(a) + toCents(b))
}

export function subMoney(a: string, b: string): string {
  return fromCents(toCents(a) - toCents(b))
}

/** a - b 的符号：> 0 返回 1，= 0 返回 0，< 0 返回 -1 */
export function compareMoney(a: string, b: string): number {
  const diff = toCents(a) - toCents(b)

  return diff === 0 ? 0 : diff > 0 ? 1 : -1
}

export function isZeroMoney(value: string): boolean {
  return toCents(value) === 0
}

/** 金额是否大于 0（用于「要不要写流水」这类判断） */
export function isPositiveMoney(value: string): boolean {
  return toCents(value) > 0
}

/**
 * 流水幂等键：同一业务事件在同一账户上只会入账一次。
 * 形如 `recharge:PAY20260101120000ABCDEF:recharge`。
 */
export function buildDedupKey(bizType: WalletBizType, bizNo: string, account: WalletAccount): string {
  return `${bizType}:${bizNo}:${account}`
}

/** 预扣拆分的展示用描述 */
export function describeSplit(giftAmount: string, rechargeAmount: string): string {
  if (isZeroMoney(giftAmount)) {
    return `充值金 ${rechargeAmount}`
  }
  if (isZeroMoney(rechargeAmount)) {
    return `赠送金 ${giftAmount}`
  }

  return `赠送金 ${giftAmount} + 充值金 ${rechargeAmount}`
}

/** 方向 → 流水的正负含义（仅用于日志文案，不参与计算） */
export function describeDirection(direction: WalletDirection): string {
  return direction === 'in' ? '收入' : '支出'
}
