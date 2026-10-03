import { and, count, desc, eq, gte, lte, type SQL } from 'drizzle-orm'
import { CommonRepo } from '#server/drizzle/CommonRepo'
import { sysMemberCoupon, sysMemberCouponUse, sysUser } from '~~/server/drizzle/schema'
import { SysMemberCouponBaseSchema } from '#shared/system/memberCoupon/common'
import type { Context } from '#server/trpc/context'

const commonRepo = CommonRepo(sysMemberCoupon, SysMemberCouponBaseSchema)

export type SysMemberCouponRangeQuery = {
  createdFrom?: string | null
  createdTo?: string | null
}

/**
 * 使用记录列：核销记录 + 使用人信息。
 * 关联的是 `sys_user`（昵称/账号/手机号），用于「这张券被谁用了」的反查。
 */
const useColumns = {
  id: sysMemberCouponUse.id,
  couponId: sysMemberCouponUse.couponId,
  couponCode: sysMemberCouponUse.couponCode,
  userId: sysMemberCouponUse.userId,
  scene: sysMemberCouponUse.scene,
  bizNo: sysMemberCouponUse.bizNo,
  discountAmount: sysMemberCouponUse.discountAmount,
  giftAmount: sysMemberCouponUse.giftAmount,
  status: sysMemberCouponUse.status,
  usedAt: sysMemberCouponUse.usedAt,
  releasedAt: sysMemberCouponUse.releasedAt,
  remark: sysMemberCouponUse.remark,
  createdAt: sysMemberCouponUse.createdAt,
  nickname: sysUser.nickname,
  username: sysUser.username,
  phone: sysUser.phone
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
    },

    /**
     * 某张券的使用记录（反查谁用了）：核销记录联表使用人，按锁定时间倒序。
     *
     * 这里不过 `buildScopedWhere`：核销记录表没有 user_id/dept_id 之外可用于部门归属的列，
     * 且能进优惠码页的角色本来就该看到全量核销情况；接口权限沿用 `system:memberCoupon:list`。
     */
    async pageUses(couponId: string, page: number, pageSize: number) {
      const totalRows = await ctx.db
        .select({ total: count() })
        .from(sysMemberCouponUse)
        .where(and(
          eq(sysMemberCouponUse.couponId, couponId),
          eq(sysMemberCouponUse.isDeleted, 0)
        ))

      const list = await ctx.db
        .select(useColumns)
        .from(sysMemberCouponUse)
        .leftJoin(sysUser, eq(sysUser.id, sysMemberCouponUse.userId))
        .where(and(
          eq(sysMemberCouponUse.couponId, couponId),
          eq(sysMemberCouponUse.isDeleted, 0)
        ))
        .orderBy(desc(sysMemberCouponUse.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize)

      return { total: Number(totalRows[0]?.total ?? 0), page, pageSize, list }
    }
  }
}
