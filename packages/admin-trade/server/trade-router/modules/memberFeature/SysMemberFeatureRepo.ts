import { and, asc, eq } from 'drizzle-orm'
import { CommonRepo } from '#admin/server/drizzle/CommonRepo'
import { sysMemberFeature } from '#trade/server/drizzle/schema'
import { SysMemberFeatureBaseSchema } from '#trade/shared/system/memberFeature/common'
import type { Context } from '#admin/server/trpc/context'

const commonRepo = CommonRepo(sysMemberFeature, SysMemberFeatureBaseSchema)

export type SysMemberFeatureRow = typeof sysMemberFeature.$inferSelect

export const sysMemberFeatureRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    /**
     * 按功能键取行（唯一性校验用）。
     * 刻意不加逻辑删除与数据范围条件：唯一索引 uk_member_feature_key 只管 feature_key，
     * 软删除的行仍然占用该键，加过滤会把重复键漏判成可新增。
     */
    async findByFeatureKey(featureKey: string): Promise<SysMemberFeatureRow | null> {
      const rows = await ctx.db
        .select()
        .from(sysMemberFeature)
        .where(eq(sysMemberFeature.featureKey, featureKey))
        .limit(1)

      return rows[0] ?? null
    },

    /**
     * 启用中的功能目录（**全局字典**，刻意不走 `buildScopedWhere`）。
     *
     * 这是 entitlement 数据源的唯一读数入口：后台能力矩阵、自助接口
     * `myEntitlements` 与服务端守卫都必须看到同一份目录，所以这里既不做数据范围
     * 过滤、也不按查询条件裁剪，缓存因此可以只有一个 key（见 MemberFeatureCacheService）。
     */
    async listEnabled(): Promise<SysMemberFeatureRow[]> {
      return await ctx.db
        .select()
        .from(sysMemberFeature)
        .where(and(
          eq(sysMemberFeature.status, 1),
          eq(sysMemberFeature.isDeleted, 0)
        ))
        .orderBy(
          asc(sysMemberFeature.groupName),
          asc(sysMemberFeature.sortOrder),
          asc(sysMemberFeature.featureKey)
        )
    },

    /** 列表排序：分组升序 → 组内排序升序 → 功能键升序（保证分页稳定） */
    featureListOrder() {
      return [
        asc(sysMemberFeature.groupName),
        asc(sysMemberFeature.sortOrder),
        asc(sysMemberFeature.featureKey)
      ]
    }
  }
}
