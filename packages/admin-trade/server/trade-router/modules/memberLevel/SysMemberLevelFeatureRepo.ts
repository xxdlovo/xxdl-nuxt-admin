import { and, count, eq, inArray, notInArray } from 'drizzle-orm'
import { sysMemberLevelFeature } from '#trade/server/drizzle/schema'
import type { Context } from '#admin/server/trpc/context'
import { randomUuid } from '#admin/shared/utils/uuid'

export type SysMemberLevelFeatureRow = typeof sysMemberLevelFeature.$inferSelect

/** 一次保存里的一项：功能键 + 该等级下的取值 */
export type SysMemberLevelFeatureValue = {
  featureKey: string
  value: number
}

/**
 * 等级 × 功能值矩阵的数据访问层。
 *
 * 这里没有用 `CommonRepo`：矩阵的写入口是「整体覆盖」（批量软删 + 批量复活/插入 + 逐条写值），
 * 不是按 id 的单行 CRUD，而且 `(level_id, feature_key)` 上有唯一键，
 * 直接 `DELETE + INSERT` 会撞键，必须走「软删 + INSERT IGNORE + UPDATE」这套。
 *
 * 注意：本表没有 user_id / dept_id，属于全局配置，**不走** `buildScopedWhere`。
 */
export const sysMemberLevelFeatureRepo = (ctx: Context) => {
  return {
    /** 某个等级已显式配置的「功能键 → 值」映射（未配置的键不在结果里） */
    async valueMapByLevel(levelId: string): Promise<Record<string, number>> {
      const rows = await ctx.db
        .select()
        .from(sysMemberLevelFeature)
        .where(and(
          eq(sysMemberLevelFeature.levelId, levelId),
          eq(sysMemberLevelFeature.isDeleted, 0)
        ))

      const values: Record<string, number> = {}

      for (const row of rows) {
        values[row.featureKey] = Number(row.value)
      }

      return values
    },

    /**
     * 批量统计多个等级的能力项数（列表页回填 `featureCount`，避免 N+1）。
     * 只算**已显式配置**的行：未配置的功能走目录默认值，不算「已配置」。
     */
    async countByLevelIds(levelIds: string[]): Promise<Record<string, number>> {
      if (levelIds.length === 0) {
        return {}
      }

      const rows = await ctx.db
        .select({
          levelId: sysMemberLevelFeature.levelId,
          total: count()
        })
        .from(sysMemberLevelFeature)
        .where(and(
          inArray(sysMemberLevelFeature.levelId, levelIds),
          eq(sysMemberLevelFeature.isDeleted, 0)
        ))
        .groupBy(sysMemberLevelFeature.levelId)

      const counts: Record<string, number> = {}

      for (const row of rows) {
        counts[row.levelId] = Number(row.total ?? 0)
      }

      return counts
    },

    /**
     * 整体覆盖某个等级的矩阵（`saveFeatures` 的唯一写入口，单事务）。
     *
     * 语义与 shared 的 `SysMemberLevelSaveFeaturesSchema` 一致：
     * - 传入的 `values` 就是该等级最终的全部配置；
     * - 未出现在 `values` 里的旧行被**软删除**（保留审计痕迹，重配时下面会把它复活）；
     * - `values` 为空 = 清空该等级的全部显式配置（回落为目录默认值）。
     *
     * 为什么不是物理 DELETE + INSERT：`uk_member_level_feature(level_id, feature_key)`
     * 会让「删了再插同一个键」在软删除语义下撞键，所以先 `INSERT IGNORE` 占位
     * （已软删的旧行命中唯一键时被忽略），再逐条 UPDATE 写值与 `is_deleted = 0`。
     */
    async replaceForLevel(input: {
      levelId: string
      values: SysMemberLevelFeatureValue[]
      operatorId: string | null
    }): Promise<void> {
      const featureKeys = input.values.map(item => item.featureKey)

      await ctx.db.transaction(async (tx) => {
        // 1) 软删除本次未提交的旧行（整体覆盖的关键一步）
        const staleWhere = featureKeys.length > 0
          ? and(
            eq(sysMemberLevelFeature.levelId, input.levelId),
            eq(sysMemberLevelFeature.isDeleted, 0),
            notInArray(sysMemberLevelFeature.featureKey, featureKeys)
          )
          : and(
            eq(sysMemberLevelFeature.levelId, input.levelId),
            eq(sysMemberLevelFeature.isDeleted, 0)
          )

        await tx
          .update(sysMemberLevelFeature)
          .set({ isDeleted: 1, updatedBy: input.operatorId })
          .where(staleWhere)

        if (input.values.length === 0) {
          return
        }

        // 2) 先占位：已存在（含已软删）的键会被 IGNORE 掉，新键插入
        await tx
          .insert(sysMemberLevelFeature)
          .ignore()
          .values(input.values.map(item => ({
            id: randomUuid(),
            levelId: input.levelId,
            featureKey: item.featureKey,
            value: item.value,
            createdBy: input.operatorId,
            updatedBy: input.operatorId,
            isDeleted: 0
          })))

        // 3) 再逐条写值（同时复活第 1 步之外可能存在的软删行）
        for (const item of input.values) {
          await tx
            .update(sysMemberLevelFeature)
            .set({
              value: item.value,
              isDeleted: 0,
              updatedBy: input.operatorId
            })
            .where(and(
              eq(sysMemberLevelFeature.levelId, input.levelId),
              eq(sysMemberLevelFeature.featureKey, item.featureKey)
            ))
        }
      })
    }
  }
}
