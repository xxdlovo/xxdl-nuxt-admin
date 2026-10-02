import { desc, eq, gte, lte, type SQL } from 'drizzle-orm'
import { CommonRepo } from '#server/drizzle/CommonRepo'
import { sysMemberCoupon } from '~~/server/drizzle/schema'
import { SysMemberCouponBaseSchema } from '#shared/system/memberCoupon/common'
import type { Context } from '#server/trpc/context'

const commonRepo = CommonRepo(sysMemberCoupon, SysMemberCouponBaseSchema)

export type SysMemberCouponRangeQuery = {
  createdFrom?: string | null
  createdTo?: string | null
}

export const sysMemberCouponRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    /**
     * 按优惠码取行（code 唯一性校验用）。
     * 刻意不加逻辑删除与数据范围条件：唯一索引 uk_member_coupon_code 只管 code，
     * 软删除的行仍然占用编码，加过滤会把重复编码漏判成可新增。
     */
    async findByCode(code: string) {
      const rows = await ctx.db
        .select()
        .from(sysMemberCoupon)
        .where(eq(sysMemberCoupon.code, code))
        .limit(1)

      return rows[0] ?? null
    },

    /**
     * 带创建时间区间的分页查询，默认按创建时间倒序（最近创建的优惠码排在前面）。
     * createdFrom / createdTo 不是表字段，buildWhereBySchema 会自动跳过，由这里消费。
     */
    async pageWithRange(
      page: number,
      pageSize: number,
      dto: Record<string, unknown>,
      range: SysMemberCouponRangeQuery = {}
    ) {
      const extraWhere: SQL[] = []

      if (range.createdFrom) {
        extraWhere.push(gte(sysMemberCoupon.createdAt, range.createdFrom))
      }
      if (range.createdTo) {
        extraWhere.push(lte(sysMemberCoupon.createdAt, range.createdTo))
      }

      return await repo.page(page, pageSize, dto, [desc(sysMemberCoupon.createdAt)], extraWhere)
    }
  }
}
