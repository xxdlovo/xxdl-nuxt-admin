/**
 * 商品 mapper（数据访问层）：新增、按 id 查、商城分页、库存与销量的条件更新。
 *
 * 库存相关一律用**条件 UPDATE + affectedRows** 判定，避免「先查再改」的并发超卖；
 * 不限库存（unlimited_stock = 1）的商品直接跳过库存判定与回滚。
 */
import { and, asc, count, desc, eq, like, or, sql } from 'drizzle-orm'
import { sysGoods } from '#server/drizzle/schema'
import { asDb, type AppExecutor } from '#server/drizzle/db'
import { affectedRows } from '../../wallet/repo/sqlUtils'

export type GoodsRow = typeof sysGoods.$inferSelect
export type GoodsInsert = typeof sysGoods.$inferInsert

export function goodsRepo(executor: AppExecutor) {
  const db = asDb(executor)

  return {
    async insert(values: GoodsInsert) {
      return await db.insert(sysGoods).values(values)
    },

    async findById(id: string): Promise<GoodsRow | null> {
      const rows = await db
        .select()
        .from(sysGoods)
        .where(and(eq(sysGoods.id, id), eq(sysGoods.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    /** 只取上架的（下单前置校验用） */
    async findEnabledById(id: string): Promise<GoodsRow | null> {
      const rows = await db
        .select()
        .from(sysGoods)
        .where(and(
          eq(sysGoods.id, id),
          eq(sysGoods.isDeleted, 0),
          eq(sysGoods.status, 1)
        ))
        .limit(1)

      return rows[0] ?? null
    },

    /**
     * 扣库存：不限库存商品直接放行，其余要求 `stock >= quantity`。
     * 返回 0 表示库存不足（或商品不存在/已删除），调用方据此抛「库存不足」。
     */
    async decreaseStock(goodsId: string, quantity: number) {
      const result: unknown = await db.execute(sql`
        update sys_goods
        set stock = stock - ${quantity}
        where id = ${goodsId}
          and is_deleted = 0
          and (unlimited_stock = 1 or stock >= ${quantity})
      `)

      return affectedRows(result)
    },

    /** 回滚库存：不限库存商品不需要回滚（库存字段本来就没动） */
    async increaseStock(goodsId: string, quantity: number) {
      const result: unknown = await db.execute(sql`
        update sys_goods
        set stock = stock + ${quantity}
        where id = ${goodsId}
          and is_deleted = 0
          and unlimited_stock = 0
      `)

      return affectedRows(result)
    },

    /** 支付完成后累加销量（同一订单只加一次，由订单状态机保证） */
    async increaseSales(goodsId: string, quantity: number) {
      return await db
        .update(sysGoods)
        .set({ salesCount: sql`${sysGoods.salesCount} + ${quantity}` })
        .where(eq(sysGoods.id, goodsId))
    },

    /** 商城分页：只列上架商品，关键字匹配名称/副标题 */
    async pageEnabled(params: {
      page: number
      pageSize: number
      keyword?: string | null
      type?: string | null
    }) {
      const conditions = [eq(sysGoods.isDeleted, 0), eq(sysGoods.status, 1)]
      const keyword = String(params.keyword ?? '').trim()

      if (keyword) {
        const pattern = `%${keyword}%`
        const matched = or(like(sysGoods.name, pattern), like(sysGoods.subtitle, pattern))

        if (matched) {
          conditions.push(matched)
        }
      }

      if (params.type) {
        conditions.push(eq(sysGoods.type, params.type))
      }

      const totalRows = await db
        .select({ total: count() })
        .from(sysGoods)
        .where(and(...conditions))

      const list = await db
        .select()
        .from(sysGoods)
        .where(and(...conditions))
        .orderBy(asc(sysGoods.sortOrder), desc(sysGoods.createdAt))
        .limit(params.pageSize)
        .offset((params.page - 1) * params.pageSize)

      return { total: Number(totalRows[0]?.total ?? 0), list }
    }
  }
}

export type GoodsRepo = ReturnType<typeof goodsRepo>
