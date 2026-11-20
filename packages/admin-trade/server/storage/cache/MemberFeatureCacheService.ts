import { SysStorageService } from '#admin/server/sys-router/storage/SysStorageService'
import {
  MEMBER_FEATURE_CACHE_KEY,
  MEMBER_FEATURE_CACHE_TTL_SECONDS,
  MEMBER_LEVEL_FEATURE_CACHE_KEY,
  MEMBER_LEVEL_FEATURE_CACHE_TTL_SECONDS,
  memberLevelFeatureMatrixCacheKey
} from './StorageCacheKeys'

/**
 * 会员功能目录 / 等级矩阵缓存门面。
 *
 * 与 `MemberLevelCacheService` 同一套路：本类**只负责缓存读写**，loader 由调用方注入
 * （存储层不 import drizzle，避免 sys/storage 反向依赖业务 repo）。
 * 目录与矩阵各只有一份数据，因此都不按查询条件拆 key：
 * - 目录：`member:feature:catalog`（固定 key）
 * - 矩阵：`member:level:feature-matrix:<levelId>`（一个等级一个 key）
 *
 * 泛型只是为了不让存储层反向依赖 trade-router 的行类型。
 */
export class MemberFeatureCacheService {
  private readonly storage = new SysStorageService()

  /** 功能目录（全部启用行）：写入口负责失效，TTL 兜底。 */
  async getCatalog<T>(loader: () => Promise<T>): Promise<T> {
    return await this.storage.rememberCache<T>(MEMBER_FEATURE_CACHE_KEY, loader, {
      ttlSeconds: MEMBER_FEATURE_CACHE_TTL_SECONDS
    })
  }

  /** 某个等级的「功能键 → 值」映射（只有显式配置过的键）。 */
  async getLevelMatrix<T>(levelId: string, loader: () => Promise<T>): Promise<T> {
    return await this.storage.rememberCache<T>(memberLevelFeatureMatrixCacheKey(levelId), loader, {
      ttlSeconds: MEMBER_LEVEL_FEATURE_CACHE_TTL_SECONDS
    })
  }

  /** 功能目录增删改成功之后调用。 */
  async invalidateCatalog() {
    await this.storage.removeCache(MEMBER_FEATURE_CACHE_KEY)
  }

  /** 某个等级的矩阵被整体覆盖之后调用；等级删除 / 批量删除也走这里。 */
  async invalidateLevelMatrix(levelId: string) {
    await this.storage.removeCache(memberLevelFeatureMatrixCacheKey(levelId))
  }

  /** 整批清理（批量删除等级等拿不到单个 id 的场景兜底）。 */
  async invalidateAllLevelMatrices() {
    await this.storage.clearCache(MEMBER_LEVEL_FEATURE_CACHE_KEY)
  }
}

export const memberFeatureCacheService = () => new MemberFeatureCacheService()
