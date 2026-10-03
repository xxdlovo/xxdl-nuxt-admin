import { and, desc, eq, gte, inArray, lte, type SQL } from 'drizzle-orm'
import { getTableColumns } from 'drizzle-orm'
import { CommonRepo } from '#server/drizzle/CommonRepo'
import { sysMemberCoupon, sysMemberRecharge, sysPayOrder } from '~~/server/drizzle/schema'
import { SysMemberRechargeBaseSchema } from '#shared/system/memberRecharge/common'
import { buildScopedWhere } from '#server/drizzle/queries/buildScope'
import type { Context } from '#server/trpc/context'

const commonRepo = CommonRepo(sysMemberRecharge, SysMemberRechargeBaseSchema)

export type SysMemberRechargeRangeQuery = {
  amountMin?: string | null
  amountMax?: string | null
  createdFrom?: string | null
  createdTo?: string | null
}

/**
 * 详情列：充值单本体 + 关联的优惠码 + 关联的支付单。
 *
 * 为什么要联表而不是让前端再点一次接口：详情页要显示「优惠码名称」「支付单号」这类
 * 可读信息，而查看充值记录的角色未必有优惠码 / 支付单模块的查询权限；
 * 一次左连接既省一次请求，也避免权限耦合。
 *
 * 别名统一加 `coupon*` / `linkedPay*` 前缀：充值单自己已有 `couponId`/`couponCode`/
 * `payOrderId`/`payChannelCode`/`payAmount` 等列，直接同名会被覆盖。
 */
const profileColumns = {
  ...getTableColumns(sysMemberRecharge),

  // 优惠码（couponId 为空时全为 null）
  couponName: sysMemberCoupon.name,
  couponType: sysMemberCoupon.type,
  couponValue: sysMemberCoupon.value,
  couponMinAmount: sysMemberCoupon.minAmount,
  couponGiftAmount: sysMemberCoupon.giftAmount,
  couponScene: sysMemberCoupon.scene,
  couponValidFrom: sysMemberCoupon.validFrom,
  couponValidTo: sysMemberCoupon.validTo,
  couponMaxUse: sysMemberCoupon.maxUse,
  couponUsedCount: sysMemberCoupon.usedCount,
  couponPerUserLimit: sysMemberCoupon.perUserLimit,
  couponBatchNo: sysMemberCoupon.batchNo,
  couponStatus: sysMemberCoupon.status,
  couponRemark: sysMemberCoupon.remark,

  // 关联支付单（payOrderId 为空时全为 null）
  linkedPayOutTradeNo: sysPayOrder.outTradeNo,
  linkedPayStatus: sysPayOrder.status,
  linkedPayChannelCode: sysPayOrder.channelCode,
  linkedPayMode: sysPayOrder.payMode,
  linkedPayAmount: sysPayOrder.amount,
  linkedPayCurrency: sysPayOrder.currency,
  linkedPaySubject: sysPayOrder.subject,
  linkedPayProviderStatus: sysPayOrder.providerStatus,
  linkedPayProviderOrderId: sysPayOrder.providerOrderId,
  linkedPayTransactionId: sysPayOrder.transactionId,
  linkedPayNotifyCount: sysPayOrder.notifyCount,
  linkedPayPaidAt: sysPayOrder.paidAt,
  linkedPayExpireAt: sysPayOrder.expireAt,
  linkedPayFailReason: sysPayOrder.failReason,
  linkedPayCreatedAt: sysPayOrder.createdAt
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
     * 详情：充值单 + 优惠码 + 支付单联表，叠加数据权限（口径与 CommonRepo.getById 一致）。
     */
    async getProfileById(id: string) {
      const where = await buildScopedWhere(sysMemberRecharge, ctx,
        eq(sysMemberRecharge.id, id),
        eq(sysMemberRecharge.isDeleted, 0))

      const rows = await ctx.db
        .select(profileColumns)
        .from(sysMemberRecharge)
        .leftJoin(sysMemberCoupon, eq(sysMemberCoupon.id, sysMemberRecharge.couponId))
        .leftJoin(sysPayOrder, eq(sysPayOrder.id, sysMemberRecharge.payOrderId))
        .where(where)
        .limit(1)

      return rows[0] ?? null
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
