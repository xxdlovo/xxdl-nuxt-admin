/**
 * 会员等级「开通 / 续费」可决策规则 —— **全项目唯一一份**。
 *
 * 两个消费方必须共用本文件，避免两处规则漂移：
 * - `SysMemberService.myLevelOptions`：把 `isCurrent` / `isActive` / `canOpen` / `blockedReason`
 *   算好返回给前端（个人中心只消费结论，不自己推导）；
 * - `MemberLevelOrderService.create`：落单前的**权威硬校验**（前端置灰只是体验，不构成防线）。
 *
 * 判定口径（与 `SysMemberService.isLevelExpired`、`MemberService.isLongTermLevel` 一致）：
 * - `isCurrent`：该等级就是会员档案上的当前等级；
 * - `isActive`：`isCurrent` 且仍在有效期内 —— `expireAt = null` 视为永不过期 → active，
 *   `expireAt > now` → active，否则（已到期）false；
 * - `blockedReason`（稳定码，文案由前端映射，服务端错误 key 复用同一语义）：
 *   - `freeAlreadyOpened`：`price = 0` 且（该等级已激活 **或** 用户已有过该等级的免费成功单据）
 *     → 价格为 0 的等级不支持重复开通 / 续费（没开通过的免费等级仍可开通）；
 *   - `longTermActive`：该等级是长期等级且已激活（长期等级没有到期时间可续，续费无意义）；
 *   - `null`：允许开通（付费等级的续费 / 同等级续费 / 异等级升级都照旧放行）。
 */
import type { SysMemberLevelBlockedReason } from '#shared/system/member'

/** 单个等级的开通决策（`myLevelOptions` 的决策字段 + 硬校验判据） */
export type LevelOpenDecision = {
  /** 该等级是否就是当前等级 */
  isCurrent: boolean
  /** 当前等级且仍在有效期内（`expireAt = null` 视为永不过期） */
  isActive: boolean
  /** 是否允许开通 / 续费 */
  canOpen: boolean
  /** 不能开通的原因码；允许开通时为 null */
  blockedReason: SysMemberLevelBlockedReason | null
}

/**
 * 是否 0 元等级。
 *
 * 与支付通道分派口径对齐（`price = 0` 走免费通道，见 `MemberLevelOrderService.create`）；
 * 价格列是 NOT NULL decimal，取不到值时按免费处理（宁可提示已开通，也不放开重复开通）。
 */
function isFreePrice(price: string | number | null | undefined): boolean {
  const amount = Number(price ?? 0)

  return !Number.isFinite(amount) || amount <= 0
}

/**
 * 计算某个等级对某个会员的可开通决策（纯函数，只读不写库）。
 *
 * @param isLongTerm 是否长期等级。**按调用方的领域口径传入**：
 *   `is_long_term = 1` 或 `duration_days <= 0`（与 `MemberService.isLongTermLevel` /
 *   `MemberLevelOrderService.create` 的判定一致），不要只传等级表的 `is_long_term`。
 * @param hasFreePaidOrder 该用户是否已有过该等级的免费成功单据
 *   （`levelOrderRepo.existsFreePaidOrder` 的结果）；非 0 元等级传 false 即可，
 *   规则内部只在免费分支读它。
 * @param now 当前时间 `YYYY-MM-DD HH:mm:ss`（与 `expireAt` 同一墙钟口径，字典序即时间序）。
 */
export function resolveLevelOpenDecision(input: {
  levelId: string
  price: string | number | null | undefined
  isLongTerm: boolean
  currentLevelId: string | null | undefined
  expireAt: string | null | undefined
  now: string
  hasFreePaidOrder: boolean
}): LevelOpenDecision {
  const isCurrent = Boolean(input.currentLevelId) && input.currentLevelId === input.levelId
  const isActive = isCurrent && (input.expireAt == null || input.expireAt > input.now)

  let blockedReason: SysMemberLevelBlockedReason | null = null

  if (isFreePrice(input.price) && (isActive || input.hasFreePaidOrder)) {
    // 免费等级重复开通 / 续费：既有需求 2 的硬约束
    blockedReason = 'freeAlreadyOpened'
  }
  else if (input.isLongTerm && isActive) {
    // 长期等级已激活：没有到期时间可续
    blockedReason = 'longTermActive'
  }

  return {
    isCurrent,
    isActive,
    canOpen: blockedReason === null,
    blockedReason
  }
}
