import { desc, gte, inArray, lte, type SQL } from 'drizzle-orm'
import { CommonRepo } from '#server/drizzle/CommonRepo'
import { sysMemberFreeze } from '~~/server/drizzle/schema'
import { SysMemberFreezeBaseSchema } from '#shared/system/memberFreeze/common'
import type { Context } from '#server/trpc/context'

const commonRepo = CommonRepo(sysMemberFreeze, SysMemberFreezeBaseSchema)

export type SysMemberFreezeRangeQuery = {
  createdFrom?: string | null
  createdTo?: string | null
}

export const sysMemberFreezeRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    /**
     * 带区间的分页查询。
     * buildWhereBySchema 只支持 eq/like，创建时间区间通过 extraWhere 追加，
     * 默认按创建时间倒序（冻结单以「最近发生」为主）。
     */
    async pageWithRange(
      page: number,
      pageSize: number,
      dto: Record<string, unknown>,
      range: SysMemberFreezeRangeQuery = {}
    ) {
      const extraWhere: SQL[] = []

      if (range.createdFrom) {
        extraWhere.push(gte(sysMemberFreeze.createdAt, range.createdFrom))
      }
      if (range.createdTo) {
        extraWhere.push(lte(sysMemberFreeze.createdAt, range.createdTo))
      }

      return await repo.page(page, pageSize, dto, [desc(sysMemberFreeze.createdAt)], extraWhere)
    },

    /**
     * 按 id 批量取未删除的冻结单。
     * 走 repo.list 是为了复用数据权限与逻辑删除条件，删除守卫据此判断状态。
     */
    async listByIds(ids: string[]) {
      if (ids.length === 0) {
        return []
      }

      return await repo.list({}, [], [inArray(sysMemberFreeze.id, ids)])
    }
  }
}
