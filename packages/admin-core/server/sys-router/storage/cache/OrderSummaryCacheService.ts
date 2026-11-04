import { SysStorageService } from '../SysStorageService'
import { ORDER_SUMMARY_CACHE_KEY, ORDER_SUMMARY_CACHE_TTL_SECONDS } from './StorageCacheKeys'

/**
 * 订单看板「与筛选区间无关」统计的缓存门面。
 *
 * 只缓存四项：今日订单数 / 今日成交额 / 待支付数 / 待交付数。
 * 区间订单数与区间成交额跟着筛选条件走，**不进缓存**（缓存它们只会得到错误结果）。
 *
 * 失效：订单状态 / 履约状态变化、以及新建订单之后由 `orderService` 显式调用
 * `invalidate()`；20 秒 TTL 只兜底两件事 —— 多进程部署下别的进程改了状态，
 * 以及跨零点时「今日」口径变化（最坏情况旧值多留 20 秒）。
 *
 * 泛型是为了不把 trade-router 的 `OrderSummary` 类型反向引到 sys-router；
 * 这个 key 只允许放这四项统计，不要再拿它缓存别的数据。
 */
export class OrderSummaryCacheService {
  private readonly storage = new SysStorageService()

  async getOverview<T>(loader: () => Promise<T>): Promise<T> {
    return await this.storage.rememberCache<T>(ORDER_SUMMARY_CACHE_KEY, loader, {
      ttlSeconds: ORDER_SUMMARY_CACHE_TTL_SECONDS
    })
  }

  /** 订单状态写入口成功之后调用；失败时（缓存删除异常）由 TTL 兜底 */
  async invalidate() {
    await this.storage.removeCache(ORDER_SUMMARY_CACHE_KEY)
  }
}

export const orderSummaryCacheService = () => new OrderSummaryCacheService()
