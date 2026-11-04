/** 字典缓存默认有效期：字典更新频率低，且写入口会主动失效。 */
export const DICT_CACHE_TTL_SECONDS = 30 * 60
/** RBAC 缓存默认有效期：主动失效负责及时更新，TTL 负责兜底。 */
export const RBAC_CACHE_TTL_SECONDS = 15 * 60
/** 会员等级启用列表缓存有效期：等级是低频变化的全局配置，写入口会主动失效。 */
export const MEMBER_LEVEL_CACHE_TTL_SECONDS = 30 * 60
/**
 * 支付渠道运行时缓存有效期：**必须短**。
 * 渠道停用 / 换密钥 / 换默认渠道后，最长 60 秒内仍可能拿旧配置验签或下单，
 * 因此除了主动失效，TTL 也必须保持在一分钟级别。
 */
export const PAY_CHANNEL_CACHE_TTL_SECONDS = 60

export const DICT_CACHE_PREFIX = 'dict:'
export const RBAC_USER_CACHE_PREFIX = 'rbac:user:'
export const RBAC_ROLE_CACHE_PREFIX = 'rbac:role:'
export const RBAC_ADMIN_CACHE_KEY = 'rbac:admin:menu-list'
/** 支付渠道运行时缓存统一前缀：按 id / 按 channelCode+currency / 按 channelCode 列表都在其下，可一次清空。 */
export const PAY_CHANNEL_CACHE_PREFIX = 'pay:channel:'

/**
 * 会员等级启用列表：只有一份数据（整表读启用行），
 * 所以用固定 key 而不是按查询条件拆 key，避免多出失效点。
 */
export const MEMBER_LEVEL_CACHE_KEY = 'member:level:enabled-list'

/**
 * 变量段统一编码；点号额外转义，避免 `.` / `..` 被 key 路径校验当成目录段拒绝。
 * 渠道编码、货币码来自请求参数，必须先过这一层。
 */
function encodeCacheSegment(value: string) {
  return encodeURIComponent(value).replace(/\./g, '%2E')
}

export function dictCacheKey(code: string) {
  return `${DICT_CACHE_PREFIX}${encodeURIComponent(code)}`
}

export function userRolesCacheKey(userId: string) {
  return `${RBAC_USER_CACHE_PREFIX}${encodeURIComponent(userId)}:roles`
}

export function roleMenusCacheKey(roleCode: string) {
  return `${RBAC_ROLE_CACHE_PREFIX}${encodeURIComponent(roleCode)}:menu-list`
}

/** 按渠道配置行 id 缓存的运行时对象（下单 / 查询 / 按 id 解析时用） */
export function payChannelRuntimeCacheKey(channelId: string) {
  return `${PAY_CHANNEL_CACHE_PREFIX}id:${encodeCacheSegment(channelId)}`
}

/**
 * 按「选择维度」缓存的运行时对象：findEnabled 的结果取决于
 * channelCode / currency 以及整表的 status、isDefault、sortOrder，
 * 所以维度里没给的部分用 `*` 占位，写入口失效时统一按前缀清空。
 */
export function payChannelEnabledCacheKey(options: { channelCode?: string | null; currency?: string | null }) {
  const code = options.channelCode?.trim().toLowerCase() || '*'
  const currency = options.currency?.trim() || '*'

  return `${PAY_CHANNEL_CACHE_PREFIX}enabled:${encodeCacheSegment(code)}:${encodeCacheSegment(currency)}`
}

/** 同一 channelCode 下全部启用渠道的运行时列表（回调逐个验签用） */
export function payChannelCodeListCacheKey(channelCode: string) {
  return `${PAY_CHANNEL_CACHE_PREFIX}code:${encodeCacheSegment(channelCode.trim().toLowerCase())}:enabled-list`
}

/**
 * 订单看板「与筛选区间无关」的统计（今日订单数/今日成交额、待支付数、待交付数）缓存有效期（秒）。
 *
 * 必须短：这四个数每 20 秒重算一次是完全可以接受的成本，而订单状态变化处会显式失效，
 * TTL 只负责兜底（例如另一个进程改了状态、进程间不共享 memory 缓存）。
 */
export const ORDER_SUMMARY_CACHE_TTL_SECONDS = 20

/**
 * 订单看板固定 key：这四个数只有一份（全局），按筛选区间拆 key 反而会多出失效点，
 * 且区间相关的两项（区间订单数/成交额）**不**走缓存、按请求实时算。
 */
export const ORDER_SUMMARY_CACHE_KEY = 'order:summary:overview'
