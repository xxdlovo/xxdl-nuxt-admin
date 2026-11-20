/**
 * 电商层（trade）自己的缓存 key / TTL。
 *
 * 说明：基座的 `StorageCacheKeys` 位于
 * `#admin/server/sys-router/storage/cache/StorageCacheKeys`，本层**没有**覆盖它
 * （路径不同，两份文件同时存在，各自只放自己的常量）。会员等级启用列表等基座常量
 * 仍从 `#admin` 引入，这里只追加 entitlement 相关的两个 key，避免为了两个常量去改 core。
 */

/**
 * 会员功能目录（`sys_member_feature` 全部启用行）缓存有效期。
 * 目录是低频变化的全局配置，写入口（新增 / 修改 / 删除）会主动失效，TTL 只是兜底。
 */
export const MEMBER_FEATURE_CACHE_TTL_SECONDS = 30 * 60

/** 功能目录固定 key：只有一份数据（整表读启用行），不按查询条件拆 key。 */
export const MEMBER_FEATURE_CACHE_KEY = 'member:feature:catalog'

/**
 * 等级 × 功能值矩阵缓存有效期。
 * 矩阵按等级拆 key（`member:level:feature-matrix:<levelId>`），
 * `saveFeatures` 与等级删除时精确失效；TTL 同样只是兜底。
 */
export const MEMBER_LEVEL_FEATURE_CACHE_TTL_SECONDS = 30 * 60

/** 等级矩阵 key 前缀；`clearCache` 按它整批清理。 */
export const MEMBER_LEVEL_FEATURE_CACHE_KEY = 'member:level:feature-matrix'

/**
 * 某个等级的矩阵 key。
 * levelId 是服务端生成的 UUID（只含十六进制与短横线），不会出现 `.` / `:` 这类
 * 会被缓存 key 路径校验拒绝的段，因此这里不做额外编码。
 */
export function memberLevelFeatureMatrixCacheKey(levelId: string) {
  return `${MEMBER_LEVEL_FEATURE_CACHE_KEY}:${levelId}`
}
