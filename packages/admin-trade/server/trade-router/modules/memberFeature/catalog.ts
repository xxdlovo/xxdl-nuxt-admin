import type { Context } from '#admin/server/trpc/context'
import { memberFeatureCacheService } from '#trade/server/storage/cache/MemberFeatureCacheService'
import { sysMemberFeatureRepo, type SysMemberFeatureRow } from './SysMemberFeatureRepo'

/**
 * 启用中的功能目录（走缓存）。
 *
 * **单一读数入口**：后台分页、等级能力矩阵、`entitlementSource` 都通过它取目录，
 * 这样「目录缓存只有一份、失效点只有一处」。缓存未命中时由 repo 整表读启用行，
 * 不做数据范围过滤（目录是全局字典）。
 */
export async function memberFeatureCatalog(ctx: Context): Promise<SysMemberFeatureRow[]> {
  return await memberFeatureCacheService().getCatalog(async () => await sysMemberFeatureRepo(ctx).listEnabled())
}
