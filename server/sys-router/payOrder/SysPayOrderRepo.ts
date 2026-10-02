import { and, desc, eq, gte, lte, type SQL } from 'drizzle-orm'
import { CommonRepo } from '#server/drizzle/CommonRepo'
import { sysPayNotifyLog, sysPayOrder } from '~~/server/drizzle/schema'
import { SysPayOrderBaseSchema } from '#shared/system/payOrder/common'
import type { Context } from '#server/trpc/context'

const commonRepo = CommonRepo(sysPayOrder, SysPayOrderBaseSchema)

export type SysPayOrderRangeQuery = {
  amountMin?: string | null
  amountMax?: string | null
  createdFrom?: string | null
  createdTo?: string | null
}

export const sysPayOrderRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    /**
     * 带区间的分页查询。
     * buildWhereBySchema 只支持 eq/like，金额与时间区间通过 extraWhere 追加，
     * 默认按创建时间倒序。
     */
    async pageWithRange(
      page: number,
      pageSize: number,
      dto: Record<string, unknown>,
      range: SysPayOrderRangeQuery = {}
    ) {
      const extraWhere: SQL[] = []

      if (range.amountMin) {
        extraWhere.push(gte(sysPayOrder.amount, range.amountMin))
      }
      if (range.amountMax) {
        extraWhere.push(lte(sysPayOrder.amount, range.amountMax))
      }
      if (range.createdFrom) {
        extraWhere.push(gte(sysPayOrder.createdAt, range.createdFrom))
      }
      if (range.createdTo) {
        extraWhere.push(lte(sysPayOrder.createdAt, range.createdTo))
      }

      return await repo.page(page, pageSize, dto, [desc(sysPayOrder.createdAt)], extraWhere)
    },

    /** 列表查询（创建时间倒序）：排序语义集中在 mapper */
    async listRecent(dto: Record<string, unknown>) {
      return await repo.list(dto, [desc(sysPayOrder.createdAt)])
    },

    /** 某笔订单的回调 / 查询日志时间线（时间倒序） */
    async listNotifyLogsByOrderId(orderId: string, limit = 200) {
      return await ctx.db
        .select()
        .from(sysPayNotifyLog)
        .where(and(
          eq(sysPayNotifyLog.orderId, orderId),
          eq(sysPayNotifyLog.isDeleted, 0)
        ))
        .orderBy(desc(sysPayNotifyLog.createdAt))
        .limit(limit)
    }
  }
}
