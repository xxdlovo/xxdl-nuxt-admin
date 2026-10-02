import { and, desc, eq, gte, inArray, lte, type SQL } from 'drizzle-orm'
import { CommonRepo } from '#server/drizzle/CommonRepo'
import { sysMemberRecharge } from '~~/server/drizzle/schema'
import { SysMemberRechargeBaseSchema } from '#shared/system/memberRecharge/common'
import type { Context } from '#server/trpc/context'

const commonRepo = CommonRepo(sysMemberRecharge, SysMemberRechargeBaseSchema)

export type SysMemberRechargeRangeQuery = {
  amountMin?: string | null
  amountMax?: string | null
  createdFrom?: string | null
  createdTo?: string | null
}

export const sysMemberRechargeRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    /**
     * 带区间的分页查询。
     * buildWhereBySchema 只支持 eq/like，金额与创建时间区间通过 extraWhere 追加，
     * 默认按创建时间倒序。
     */
    async pageWithRange(
      page: number,
      pageSize: number,
      dto: Record<string, unknown>,
      range: SysMemberRechargeRangeQuery = {}
    ) {
      const extraWhere: SQL[] = []

      if (range.amountMin) {
        extraWhere.push(gte(sysMemberRecharge.amount, range.amountMin))
      }
      if (range.amountMax) {
        extraWhere.push(lte(sysMemberRecharge.amount, range.amountMax))
      }
      if (range.createdFrom) {
        extraWhere.push(gte(sysMemberRecharge.createdAt, range.createdFrom))
      }
      if (range.createdTo) {
        extraWhere.push(lte(sysMemberRecharge.createdAt, range.createdTo))
      }

      return await repo.page(page, pageSize, dto, [desc(sysMemberRecharge.createdAt)], extraWhere)
    },

    /**
     * 按 id 批量取未删除的充值单。
     * 走 repo.list 是为了复用数据权限与逻辑删除条件，删除 / 关闭守卫据此判断状态。
     */
    async listByIds(ids: string[]) {
      if (ids.length === 0) {
        return []
      }

      return await repo.list({}, [], [inArray(sysMemberRecharge.id, ids)])
    },

    /**
     * 关闭充值单：状态置 CL、关闭原因复用 fail_reason 列。
     * WHERE 带上 status = 'WP' 守卫，并发下不会把已关闭 / 已到账的单子改回去。
     */
    async markClosed(id: string, reason: string | null) {
      return await ctx.db
        .update(sysMemberRecharge)
        .set({ status: 'CL', failReason: reason, updatedBy: ctx.user?.id ?? null })
        .where(and(
          eq(sysMemberRecharge.id, id),
          eq(sysMemberRecharge.status, 'WP'),
          eq(sysMemberRecharge.isDeleted, 0)
        ))
    }
  }
}
