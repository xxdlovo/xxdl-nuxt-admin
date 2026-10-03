//#server/sys-router/home
/**
 * 首页看板 mapper（本项目里唯一写 drizzle 的地方）。
 *
 * 范围隔离：每个 SQL 都接收 `userId: string | null`
 * - `null` 只在管理员路径传入（= 全平台聚合）；
 * - 非 null 时**必须**落到 `user_id = ?`，个人看板绝不会统计到别人的数据。
 * 所有查询都带 `is_deleted = 0`（目标表都有该列）。
 *
 * 口径来源（同一指标不允许两处口径漂移）：
 * - 待支付 / 待交付：`server/trade-router/domain/order/repo/orderRepo.ts` 的
 *   `countPendingOverview()`（`status='WP'`；`status='OD' and fulfill_status='pending'`）；
 * - 成交额：同文件 `sumByRange()`（只累加 `status='OD'` 的 `pay_amount`）；
 * - 管理员的上述指标与「今日」口径直接复用 `OrderService.summary()`（含 20s 缓存），
 *   本文件不重复实现，见 `SysHomeService`；
 * - 可用优惠码数：复用 `couponUseRepo.countLockedByUser()`（couponId 放宽为 null）。
 */
import { and, count, eq, gte, lte, sql, type SQL } from 'drizzle-orm'
import { sysGoods, sysMember, sysMemberRecharge, sysMemberWallet, sysOrder, sysUser } from '~~/server/drizzle/schema'
import { asDb } from '#server/drizzle/db'
import { couponUseRepo } from '#server/trade-router/domain/member/repo/couponUseRepo'
import type { Context } from '#server/trpc/context'

export const sysHomeRepo = (ctx: Context) => {
  return {
    /**
     * 管理员 stats：用户总数 / 启用会员数 / 启用商品数。
     * 三张表互不相关，合并成一次 Promise.all，避免串行三次往返。
     */
    async countPlatformStats() {
      const [userRows, memberRows, goodsRows] = await Promise.all([
        ctx.db
          .select({ total: count() })
          .from(sysUser)
          .where(eq(sysUser.isDeleted, 0)),
        ctx.db
          .select({ total: count() })
          .from(sysMember)
          .where(and(eq(sysMember.isDeleted, 0), eq(sysMember.status, 1))),
        ctx.db
          .select({ total: count() })
          .from(sysGoods)
          .where(and(eq(sysGoods.isDeleted, 0), eq(sysGoods.status, 1)))
      ])

      return {
        userCount: Number(userRows[0]?.total ?? 0),
        memberCount: Number(memberRows[0]?.total ?? 0),
        goodsCount: Number(goodsRows[0]?.total ?? 0)
      }
    },

    /**
     * 累计充值额：`sys_member_recharge.status = 'OD'` 的 `amount` 求和。
     * `userId = null` 为全平台（管理员），非 null 为某会员个人累计充值。
     * 金额由 SQL 聚合并 cast 成 decimal(20,2)，JS 侧只做补零展示，不参与浮点累加。
     */
    async sumRechargeAmount(userId: string | null): Promise<string> {
      const conditions: SQL[] = [
        eq(sysMemberRecharge.isDeleted, 0),
        eq(sysMemberRecharge.status, 'OD')
      ]
      if (userId !== null) {
        conditions.push(eq(sysMemberRecharge.userId, userId))
      }

      const rows = await ctx.db
        .select({
          totalAmount: sql<string>`cast(coalesce(sum(${sysMemberRecharge.amount}), 0) as decimal(20,2))`
        })
        .from(sysMemberRecharge)
        .where(and(...conditions))

      return String(rows[0]?.totalAmount ?? '0.00')
    },

    /**
     * 订单状态分布（管理员饼图：一个枚举码一项）。
     * `userId = null` 为全平台，非 null 为该用户（个人路径当前不用，保持签名一致）。
     */
    async countOrderStatus(userId: string | null): Promise<Array<{ status: string, total: number }>> {
      const conditions: SQL[] = [eq(sysOrder.isDeleted, 0)]
      if (userId !== null) {
        conditions.push(eq(sysOrder.userId, userId))
      }

      const rows = await ctx.db
        .select({ status: sysOrder.status, total: count() })
        .from(sysOrder)
        .where(and(...conditions))
        .groupBy(sysOrder.status)

      return rows.map(row => ({ status: String(row.status), total: Number(row.total ?? 0) }))
    },

    /**
     * 订单聚合：一条 `SUM(CASE WHEN ...)` 取回个人看板的多个指标。
     *
     * 条件语义与 `OrderService.summary()` / `orderRepo` 完全对齐：
     * - 计数口径 `is_deleted = 0`（口径来源：orderRepo.countPendingOverview）；
     * - 待支付 `status = 'WP'`（口径来源：orderRepo.countPendingOverview）；
     * - 待交付 `status = 'OD' and fulfill_status = 'pending'`（口径来源：orderRepo.countPendingOverview）；
     * - 已完成 `status = 'OD'`（管理员侧为饼图同一口径）；
     * - 累计消费 `status = 'OD'` 的 `pay_amount` 求和（口径来源：orderRepo.sumByRange.totalAmount）。
     */
    async sumOrderOverview(userId: string | null) {
      const conditions: SQL[] = [eq(sysOrder.isDeleted, 0)]
      if (userId !== null) {
        conditions.push(eq(sysOrder.userId, userId))
      }

      const rows = await ctx.db
        .select({
          orderTotal: count(),
          pendingCount: sql<number>`cast(coalesce(sum(case when ${sysOrder.status} = 'WP' then 1 else 0 end), 0) as signed)`,
          pendingFulfillCount: sql<number>`cast(coalesce(sum(case when ${sysOrder.status} = 'OD' and ${sysOrder.fulfillStatus} = 'pending' then 1 else 0 end), 0) as signed)`,
          completedCount: sql<number>`cast(coalesce(sum(case when ${sysOrder.status} = 'OD' then 1 else 0 end), 0) as signed)`,
          consumeAmount: sql<string>`cast(coalesce(sum(case when ${sysOrder.status} = 'OD' then ${sysOrder.payAmount} else 0 end), 0) as decimal(20,2))`
        })
        .from(sysOrder)
        .where(and(...conditions))

      const row = rows[0]

      return {
        orderTotal: Number(row?.orderTotal ?? 0),
        pendingCount: Number(row?.pendingCount ?? 0),
        pendingFulfillCount: Number(row?.pendingFulfillCount ?? 0),
        completedCount: Number(row?.completedCount ?? 0),
        consumeAmount: String(row?.consumeAmount ?? '0.00')
      }
    },

    /**
     * 钱包汇总：可用余额（充值金）/ 赠送金 / 冻结中（冻结充值金 + 冻结赠送金）。
     *
     * - `userId = null`：全平台 `SUM(...)`（管理员范围）；
     * - 非 null：`uk_member_wallet_user` 保证一人一行，聚合结果即该用户那一行。
     * 全部走 `COALESCE(...,0)` 兜底，钱包缺行时返回 0.00。
     */
    async sumWalletTotals(userId: string | null) {
      const conditions: SQL[] = [eq(sysMemberWallet.isDeleted, 0)]
      if (userId !== null) {
        conditions.push(eq(sysMemberWallet.userId, userId))
      }

      const rows = await ctx.db
        .select({
          recharge: sql<string>`cast(coalesce(sum(${sysMemberWallet.rechargeBalance}), 0) as decimal(20,2))`,
          gift: sql<string>`cast(coalesce(sum(${sysMemberWallet.giftBalance}), 0) as decimal(20,2))`,
          frozen: sql<string>`cast(coalesce(sum(${sysMemberWallet.frozenRecharge}), 0) + coalesce(sum(${sysMemberWallet.frozenGift}), 0) as decimal(20,2))`
        })
        .from(sysMemberWallet)
        .where(and(...conditions))

      const row = rows[0]

      return {
        recharge: String(row?.recharge ?? '0.00'),
        gift: String(row?.gift ?? '0.00'),
        frozen: String(row?.frozen ?? '0.00')
      }
    },

    /**
     * 近 14 天每日订单数 / 成交额（`from` / `to` 为闭区间的 MySQL 时间串）。
     *
     * 必须用 `date_format(...)` 取**字符串**日期：`DATE(created_at)` 会被 mysql2 转成
     * JS `Date`（按 UTC 表达，少 8 小时），与 14 天 `YYYY-MM-DD` 序列无法对齐、类型也不符。
     * 只返回有数据的日期，零填充由 Service 完成。
     * 成交额口径同 `orderRepo.sumByRange`：只累加 `status = 'OD'` 的 `pay_amount`。
     */
    async listOrderTrendDaily(params: { userId: string | null, from: string, to: string }) {
      const { userId, from, to } = params
      const dayExpr = sql<string>`date_format(${sysOrder.createdAt}, '%Y-%m-%d')`
      const conditions: SQL[] = [
        eq(sysOrder.isDeleted, 0),
        gte(sysOrder.createdAt, from),
        lte(sysOrder.createdAt, to)
      ]
      if (userId !== null) {
        conditions.push(eq(sysOrder.userId, userId))
      }

      const rows = await ctx.db
        .select({
          day: dayExpr,
          orderCount: count(),
          orderAmount: sql<string>`cast(coalesce(sum(case when ${sysOrder.status} = 'OD' then ${sysOrder.payAmount} else 0 end), 0) as decimal(20,2))`
        })
        .from(sysOrder)
        .where(and(...conditions))
        .groupBy(dayExpr)
        .orderBy(dayExpr)

      return rows.map(row => ({
        day: String(row.day),
        orderCount: Number(row.orderCount ?? 0),
        orderAmount: String(row.orderAmount ?? '0.00')
      }))
    },

    /**
     * 可用优惠码数：已锁定未核销的券行数。
     * 复用 `couponUseRepo.countLockedByUser(null, userId)`（本文件不复制该语义）。
     */
    async countLockedCoupons(userId: string): Promise<number> {
      return await couponUseRepo(asDb(ctx.db)).countLockedByUser(null, userId)
    }
  }
}

export type SysHomeRepo = ReturnType<typeof sysHomeRepo>
