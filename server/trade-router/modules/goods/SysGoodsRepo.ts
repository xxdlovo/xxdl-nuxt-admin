import { asc, desc, gte, lte, type SQL } from 'drizzle-orm'
import { CommonRepo } from '#server/drizzle/CommonRepo'
import { sysGoods } from '~~/server/drizzle/schema'
import { SysGoodsBaseSchema } from '#shared/system/goods/common'
import type { Context } from '#server/trpc/context'

const commonRepo = CommonRepo(sysGoods, SysGoodsBaseSchema)

export type SysGoodsRangeQuery = {
  priceMin?: string | number | null
  priceMax?: string | number | null
  createdFrom?: string | null
  createdTo?: string | null
}

/** 区间边界统一成字符串：decimal 列在 drizzle 里按字符串比较，空值/空串表示「不限」 */
function rangeText(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }

  const text = String(value).trim()

  return text === '' ? null : text
}

export const sysGoodsRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  /** 列表排序：运营排序升序 → 创建时间倒序（sortOrder 相同的商品按最新在前） */
  const listOrder = () => [asc(sysGoods.sortOrder), desc(sysGoods.createdAt)]

  return {
    ...repo,

    /** 排序语义集中在 mapper，Service 不关心 SQL */
    goodsListOrder() {
      return listOrder()
    },

    /**
     * 带价格区间与创建时间区间的分页查询。
     * buildWhereBySchema 只支持 eq/like，priceMin / priceMax / createdFrom / createdTo
     * 不是表字段，由这里用 extraWhere 追加（与 payOrder、memberFreeze 同做法）。
     */
    async pageWithRange(
      page: number,
      pageSize: number,
      dto: Record<string, unknown>,
      range: SysGoodsRangeQuery = {}
    ) {
      const extraWhere: SQL[] = []
      const priceMin = rangeText(range.priceMin)
      const priceMax = rangeText(range.priceMax)

      if (priceMin) {
        extraWhere.push(gte(sysGoods.price, priceMin))
      }
      if (priceMax) {
        extraWhere.push(lte(sysGoods.price, priceMax))
      }
      if (range.createdFrom) {
        extraWhere.push(gte(sysGoods.createdAt, range.createdFrom))
      }
      if (range.createdTo) {
        extraWhere.push(lte(sysGoods.createdAt, range.createdTo))
      }

      return await repo.page(page, pageSize, dto, listOrder(), extraWhere)
    }
  }
}
