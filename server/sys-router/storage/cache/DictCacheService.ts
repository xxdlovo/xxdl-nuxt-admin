import type { SysDictDataDto } from '#shared/system/dictData'
import { SysStorageService } from '../SysStorageService'
import { DICT_CACHE_PREFIX, DICT_CACHE_TTL_SECONDS, dictCacheKey } from './StorageCacheKeys'

/**
 * 字典缓存门面。业务服务只需传入编码和数据库 loader，缓存读写、TTL、
 * 并发合并和异常降级均由 SysStorageService 统一处理。
 */
export class DictCacheService {
  private readonly storage = new SysStorageService()

  async getByTypeCode(code: string, loader: () => Promise<SysDictDataDto[]>) {
    return this.storage.rememberCache(dictCacheKey(code), loader, { ttlSeconds: DICT_CACHE_TTL_SECONDS })
  }

  async invalidate(code: string) {
    await this.storage.removeCache(dictCacheKey(code))
  }

  async invalidateAll() {
    await this.storage.clearCache(DICT_CACHE_PREFIX)
  }
}

export const dictCacheService = () => new DictCacheService()
