/**
 * 商品等级价 mapper（数据访问层）。
 *
 * 一个商品 × 一个会员等级 一行；没有行 = 该等级用商品基础价。
 * 保存策略是「整体替换」：先软删该商品旧行，再插入新行（事务由 Service 保证）。
 */
import { and, count, eq, inArray, sql } from 'drizzle-orm'
import { sysGoodsLevelPrice } from '#server/drizzle/schema'
import { asDb, type AppExecutor } from '#server/drizzle/db'
import { affectedRows } from '../../wallet/repo/sqlUtils'

export type GoodsLevelPriceRow = typeof sysGoodsLevelPrice.$inferSelect
export type GoodsLevelPriceInsert = typeof sysGoodsLevelPrice.$inferInsert

export function goodsLevelPriceRepo(executor: AppExecutor) {
  const db = asDb(executor)

  return {
    async insertMany(values: GoodsLevelPriceInsert[]) {
      if (values.length === 0) {
        return
      }

      await db.insert(sysGoodsLevelPrice).values(values)
    },

    /** 某商品的全部有效等级价（商品编辑弹窗回显） */
    async listByGoodsId(goodsId: string): Promise<GoodsLevelPriceRow[]> {
      return await db
        .select()
        .from(sysGoodsLevelPrice)
        .where(and(
          eq(sysGoodsLevelPrice.goodsId, goodsId),
          eq(sysGoodsLevelPrice.isDeleted, 0)
        ))
    },

    /** 批量取（商城列表用，避免逐个商品查询） */
    async listByGoodsIds(goodsIds: string[]): Promise<GoodsLevelPriceRow[]> {
      if (goodsIds.length === 0) {
        return []
      }

      return await db
        .select()
        .from(sysGoodsLevelPrice)
        .where(and(
          inArray(sysGoodsLevelPrice.goodsId, goodsIds),
          eq(sysGoodsLevelPrice.isDeleted, 0)
        ))
    },

    /**
     * 按商品批量统计等级价行数（后台商品列表「配了几个等级价」展示用）。
     * 一条 `group by goods_id` 覆盖整页，避免每行查一次。
     * 过滤条件与同文件其他查询保持一致（清理走物理删除，is_deleted 过滤是兜底）。
     */
    async countByGoodsIds(goodsIds: string[]): Promise<Array<{ goodsId: string; count: number }>> {
      if (goodsIds.length === 0) {
        return []
      }

      return await db
        .select({
          goodsId: sysGoodsLevelPrice.goodsId,
          count: count()
        })
        .from(sysGoodsLevelPrice)
        .where(and(
          inArray(sysGoodsLevelPrice.goodsId, goodsIds),
          eq(sysGoodsLevelPrice.isDeleted, 0)
        ))
        .groupBy(sysGoodsLevelPrice.goodsId)
    },

    async findByGoodsAndLevel(goodsId: string, levelId: string): Promise<GoodsLevelPriceRow | null> {
      const rows = await db
        .select()
        .from(sysGoodsLevelPrice)
        .where(and(
          eq(sysGoodsLevelPrice.goodsId, goodsId),
          eq(sysGoodsLevelPrice.levelId, levelId),
          eq(sysGoodsLevelPrice.isDeleted, 0)
        ))
        .limit(1)

      return rows[0] ?? null
    },

    /**
     * 清空该商品的等级价（整体替换第一步）。
     *
     * 这里用**物理删除**：唯一键 `uk_goods_level(goods_id, level_id)` 不包含 is_deleted，
     * 若改成软删，重新给同一等级配价时会撞唯一键。等级价是配置数据、不是资金凭证，
     * 因此不保留软删历史，直接删干净再插新行（事务由 Service 保证）。
     */
    async deleteByGoodsId(goodsId: string) {
      const result: unknown = await db.execute(sql`
        delete from sys_goods_level_price where goods_id = ${goodsId}
      `)

      return affectedRows(result)
    }
  }
}

export type GoodsLevelPriceRepo = ReturnType<typeof goodsLevelPriceRepo>
