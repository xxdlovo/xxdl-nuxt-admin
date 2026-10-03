import { SysStorageService } from '../SysStorageService'
import { MEMBER_LEVEL_CACHE_KEY, MEMBER_LEVEL_CACHE_TTL_SECONDS } from './StorageCacheKeys'

/**
 * 会员等级「启用列表」缓存门面。
 *
 * 数据只有一份（`levelRepo.listEnabled()` 整表读启用中的等级），所以只用一个固定 key：
 * 按条件拆多个 key 会多出失效点，也违反「不给同一份数据建多个缓存」的约定。
 *
 * 泛型是为了不把 trade-router 的 `LevelRow` 类型反向引到 sys-router；
 * 这个 key 只允许放「启用中的会员等级列表」，不要再拿它缓存别的数据。
 */
export class MemberLevelCacheService {
  private readonly storage = new SysStorageService()

  async getEnabledList<T>(loader: () => Promise<T>): Promise<T> {
    return await this.storage.rememberCache<T>(MEMBER_LEVEL_CACHE_KEY, loader, {
      ttlSeconds: MEMBER_LEVEL_CACHE_TTL_SECONDS
    })
  }

  /** 会员等级写入口（新增 / 修改 / 删除 / 批量删除）成功之后调用；TTL 只是兜底。 */
  async invalidate() {
    await this.storage.removeCache(MEMBER_LEVEL_CACHE_KEY)
  }
}

export const memberLevelCacheService = () => new MemberLevelCacheService()
