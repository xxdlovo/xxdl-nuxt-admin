import type { PayChannelRuntime } from '#server/trade-router/domain/pay/types'
import { SysStorageService } from '../SysStorageService'
import {
  PAY_CHANNEL_CACHE_PREFIX,
  PAY_CHANNEL_CACHE_TTL_SECONDS,
  payChannelCodeListCacheKey,
  payChannelEnabledCacheKey,
  payChannelRuntimeCacheKey
} from './StorageCacheKeys'

/**
 * 支付渠道「运行时配置」缓存门面。
 *
 * 缓存的是**已解密**的 `PayChannelRuntime`：回调、下单、查单每次都要读库并经
 * `decryptConfigSecrets` 逐字段 AES 解密，而回调是外部平台可重试、可并发的入口。
 *
 * 三个访问维度对应 `PayChannelResolver` 的三个读点：
 * - 按渠道行 id（`getRuntimeById`）；
 * - 按 channelCode + currency 的选择结果（`resolvePayChannel` 的 findEnabled）；
 * - 按 channelCode 的启用渠道列表（回调逐个验签）。
 *
 * ⚠️ 风险（必须知道再用）：
 * 1) 渠道**停用**、**换密钥**、改渠道类型或换默认渠道后，最长
 *    `PAY_CHANNEL_CACHE_TTL_SECONDS`（60 秒）内仍会用**旧配置**验签 / 下单；
 * 2) 因此 TTL 必须保持很短，并且 `SysPayChannelService` 的全部写入口
 *    （create / updateById / remove / batchRemove / verify / setDefault）成功之后
 *    都必须调用 `invalidateAll()`；
 * 3) 这里缓存的是内存（memory 桶），只在当前进程有效：多实例部署时各实例各自过期，
 *    不能把它当共享配置中心；
 * 4) 缓存里是**明文密钥**，只允许留在服务端内存中，绝不能经接口回传前端。
 *
 * 三个维度的 key 都在 `PAY_CHANNEL_CACHE_PREFIX` 之下，所以「一次清空」就是唯一的失效点，
 * 不会出现「只漏清某一个维度」的副本。
 */
export class PayChannelCacheService {
  private readonly storage = new SysStorageService()

  /**
   * `rememberCache` 把 `null` 当成 miss，因此用一层包装把「查不到渠道」也缓存住，
   * 否则停用/删除后的无效 id 会一直回源。
   */
  private async rememberRuntime(key: string, loader: () => Promise<PayChannelRuntime | null>) {
    const entry = await this.storage.rememberCache<{ runtime: PayChannelRuntime | null }>(
      key,
      async () => ({ runtime: await loader() }),
      { ttlSeconds: PAY_CHANNEL_CACHE_TTL_SECONDS }
    )

    return entry.runtime
  }

  /** 按渠道行 id 取运行时（渠道不存在或 provider 未注册时返回 null / 抛错，与回源行为一致） */
  async getRuntimeById(channelId: string, loader: () => Promise<PayChannelRuntime | null>) {
    return await this.rememberRuntime(payChannelRuntimeCacheKey(channelId), loader)
  }

  /** 按 channelCode + currency 取「启用中的第一个渠道」（没有可用渠道时缓存 null） */
  async getEnabledRuntime(
    options: { channelCode?: string | null; currency?: string | null },
    loader: () => Promise<PayChannelRuntime | null>
  ) {
    return await this.rememberRuntime(payChannelEnabledCacheKey(options), loader)
  }

  /** 同一 channelCode 下全部启用渠道的运行时列表（空数组也会被缓存，不是 miss） */
  async getEnabledRuntimesByCode(channelCode: string, loader: () => Promise<PayChannelRuntime[]>) {
    return await this.storage.rememberCache<PayChannelRuntime[]>(
      payChannelCodeListCacheKey(channelCode),
      loader,
      { ttlSeconds: PAY_CHANNEL_CACHE_TTL_SECONDS }
    )
  }

  /**
   * 只删按 id 的那一个 key。
   * 该渠道的 status / isDefault / channelCode 变化会影响 enabled 与 code 列表两个维度，
   * 那两种情况请用 `invalidateAll()`（写入口一律用 invalidateAll）。
   */
  async invalidate(channelId: string) {
    await this.storage.removeCache(payChannelRuntimeCacheKey(channelId))
  }

  /** 渠道配置任何写操作成功后调用：整前缀清空，覆盖三个维度 */
  async invalidateAll() {
    await this.storage.clearCache(PAY_CHANNEL_CACHE_PREFIX)
  }
}

export const payChannelCacheService = () => new PayChannelCacheService()
