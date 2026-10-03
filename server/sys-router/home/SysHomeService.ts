import { sysHomeRepo } from './SysHomeRepo'
import type { Context } from '#server/trpc/context'
import { orderService } from '#server/trade-router/domain/order/OrderService'
import { nowForMysql } from '#server/trade-router/domain/pay/utils'
import { AppError } from '#server/utils/appError'
import { SysOrderStatusSchema } from '#shared/system/order/input'
import type { SysHomeItemDTO, SysHomeOverviewRespDTO, SysHomePieDTO, SysHomeTrendDTO } from '#shared/system/home'

/** 趋势区间（冻结口径：近 14 天，含今天，升序） */
const TREND_DAYS = 14

/** 订单状态枚举码，顺序即饼图顺序 WP / OD / CL / FL（复用订单域 Schema，不另立一份） */
const ORDER_STATUSES = SysOrderStatusSchema.options

/**
 * 近 N 天日期序列（`YYYY-MM-DD`，升序，含今天）。
 *
 * 用本地墙钟日期构造，与 `nowForMysql()` 同处一个时区；
 * **不能用 `toISOString()`**：它按 UTC 输出，会整体错位 8 小时，与 SQL 的 `date_format`
 * 结果匹配不上，零填充就会全部落空。
 */
function recentDates(days: number): string[] {
  const pad = (value: number) => String(value).padStart(2, '0')
  const base = new Date()
  const dates: string[] = []

  for (let offset = days - 1; offset >= 0; offset--) {
    const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() - offset)
    dates.push(`${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`)
  }

  return dates
}

/** 金额展示：SQL 已聚合为 decimal(20,2)，这里只补足 2 位小数，不做任何浮点累加 */
function moneyText(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00'
}

/** 计数展示：整数字符串 */
function countText(value: number | null | undefined): string {
  return String(Math.trunc(Number(value ?? 0)))
}

function countItem(key: string, value: string): SysHomeItemDTO {
  return { key, value, unit: 'count' }
}

function moneyItem(key: string, value: string): SysHomeItemDTO {
  return { key, value, unit: 'money' }
}

/**
 * 趋势零填充：SQL 的 `group by date_format(...)` 只返回有数据的日期，
 * 这里按完整 14 天序列回填，缺日补 0，并保证 `data` 与 `dates` 等长。
 */
function buildTrend(
  dates: string[],
  rows: Array<{ day: string, orderCount: number, orderAmount: string }>
): SysHomeTrendDTO {
  const countByDay = new Map(rows.map(row => [row.day, Number(row.orderCount ?? 0)]))
  const amountByDay = new Map(rows.map(row => [row.day, Number(row.orderAmount ?? 0)]))

  return {
    dates,
    series: [
      { key: 'orderCount', unit: 'count', data: dates.map(day => countByDay.get(day) ?? 0) },
      { key: 'orderAmount', unit: 'money', data: dates.map(day => amountByDay.get(day) ?? 0) }
    ]
  }
}

/**
 * 首页看板服务：按登录者身份决定数据范围。
 *
 * - `is_admin = 1` → `scope = 'admin'`，全平台数据；
 * - 其他登录用户 → `scope = 'self'`，只统计 `user_id = 当前用户`（self 分支不调用任何全局聚合）。
 *
 * 管理员订单指标口径来源：`OrderService.summary({})`（`server/trade-router/domain/order/OrderService.ts`），
 * 与订单管理看板共用同一条实现，并复用其 20 秒 overview 缓存（今日订单数 / 今日成交额 /
 * 待支付 / 待交付）；`totalAmount` 由同一次调用的区间聚合给出（全时段 `status='OD'` 的 `pay_amount`）。
 * 自视图不能复用 summary（它没有 user 维度），由 `SysHomeRepo` 用带 `user_id = ?` 的
 * `SUM(CASE WHEN ...)` 聚合实现，条件语义与 summary / orderRepo 完全一致。
 */
export function sysHomeService(ctx: Context) {
  const repo = sysHomeRepo(ctx)

  /** 管理员：全平台 */
  async function adminOverview(dates: string[], from: string, to: string): Promise<SysHomeOverviewRespDTO> {
    const [platform, orderSummary, rechargeAmount, trendRows, statusRows] = await Promise.all([
      repo.countPlatformStats(),
      orderService(ctx.db).summary({}),
      repo.sumRechargeAmount(null),
      repo.listOrderTrendDaily({ userId: null, from, to }),
      repo.countOrderStatus(null)
    ])

    const statusCount = new Map(statusRows.map(row => [row.status, row.total]))
    const pie: SysHomePieDTO = {
      kind: 'orderStatus',
      // 四种状态都给出（缺失补 0），前端按 name 映射 i18n，饼图图例才不会跳变
      items: ORDER_STATUSES.map(status => ({ name: status, value: statusCount.get(status) ?? 0 }))
    }

    return {
      scope: 'admin',
      stats: [
        countItem('userCount', countText(platform.userCount)),
        countItem('memberCount', countText(platform.memberCount)),
        countItem('goodsCount', countText(platform.goodsCount))
      ],
      cards: [
        countItem('todayOrderCount', countText(orderSummary.todayCount)),
        moneyItem('todayOrderAmount', moneyText(orderSummary.todayAmount)),
        countItem('pendingCount', countText(orderSummary.pendingCount)),
        countItem('pendingFulfillCount', countText(orderSummary.pendingFulfillCount)),
        moneyItem('totalOrderAmount', moneyText(orderSummary.totalAmount)),
        moneyItem('totalRechargeAmount', moneyText(rechargeAmount))
      ],
      trend: buildTrend(dates, trendRows),
      pie,
      generatedAt: nowForMysql()
    }
  }

  /** 个人：只统计自己 */
  async function selfOverview(userId: string, dates: string[], from: string, to: string): Promise<SysHomeOverviewRespDTO> {
    const [orders, wallet, rechargeAmount, trendRows, lockedCoupons] = await Promise.all([
      repo.sumOrderOverview(userId),
      repo.sumWalletTotals(userId),
      repo.sumRechargeAmount(userId),
      repo.listOrderTrendDaily({ userId, from, to }),
      repo.countLockedCoupons(userId)
    ])

    const pie: SysHomePieDTO = {
      kind: 'balance',
      items: [
        { name: 'recharge', value: Number(wallet.recharge) },
        { name: 'gift', value: Number(wallet.gift) },
        { name: 'frozen', value: Number(wallet.frozen) }
      ]
    }

    return {
      scope: 'self',
      stats: [
        moneyItem('myBalance', moneyText(wallet.recharge)),
        moneyItem('myGift', moneyText(wallet.gift)),
        countItem('myCoupon', countText(lockedCoupons))
      ],
      cards: [
        countItem('myOrderTotal', countText(orders.orderTotal)),
        countItem('myPending', countText(orders.pendingCount)),
        countItem('myFulfill', countText(orders.pendingFulfillCount)),
        countItem('myCompleted', countText(orders.completedCount)),
        moneyItem('myConsume', moneyText(orders.consumeAmount)),
        moneyItem('myRecharge', moneyText(rechargeAmount))
      ],
      trend: buildTrend(dates, trendRows),
      pie,
      generatedAt: nowForMysql()
    }
  }

  return {
    async overview(): Promise<SysHomeOverviewRespDTO> {
      const dates = recentDates(TREND_DAYS)
      const from = `${dates[0]} 00:00:00`
      const to = `${dates[dates.length - 1]} 23:59:59`

      if (ctx.user?.isAdmin === 1) {
        return await adminOverview(dates, from, to)
      }

      // 个人分支必须有明确的 userId：拿不到宁可直接报未登录，也绝不退化成全平台聚合
      const userId = ctx.user?.id
      if (!userId) {
        throw new AppError('auth.unauthorized')
      }

      return await selfOverview(userId, dates, from, to)
    }
  }
}
