import type { Context } from '#admin/server/trpc/context'
import { memberFeatureCacheService } from '#trade/server/storage/cache/MemberFeatureCacheService'
import { sysMemberLevelFeatureRepo } from './SysMemberLevelFeatureRepo'

/**
 * 某个等级已显式配置的「功能键 → 值」映射（走缓存）。
 *
 * 与 `memberFeatureCatalog` 一样是**单一读数入口**：等级能力矩阵与
 * `entitlementSource` 共用，避免同一等级在一处读缓存、一处直查库导致口径漂移。
 * 缓存失效点：`saveFeatures`（整体覆盖）与等级删除（见 SysMemberLevelService）。
 */
export async function memberLevelFeatureMatrix(
  ctx: Context,
  levelId: string
): Promise<Record<string, number>> {
  return await memberFeatureCacheService().getLevelMatrix(
    levelId,
    async () => await sysMemberLevelFeatureRepo(ctx).valueMapByLevel(levelId)
  )
}
