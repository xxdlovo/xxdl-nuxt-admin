import { z } from 'zod'

/**
 * 首页看板契约（服务端按登录者身份决定数据范围）。
 *
 * 字段名与枚举值已冻结，前端依赖 `key` / `name` 映射 i18n：
 * - `stats` 3 项、`cards` 6 项，value 统一为展示字符串（计数为整数字符串，金额为 2 位小数字符串）；
 * - `trend.dates` 为 14 个 `YYYY-MM-DD`（升序，缺数据的日期也必须在），`series[].data` 等长且缺日补 0；
 * - `pie.name`：orderStatus 用订单枚举码（WP/OD/CL/FL），balance 用 recharge/gift/frozen。
 */
export const SysHomeItemSchema = z.object({
  key: z.string(),                      // 稳定 key，前端映射 i18n
  value: z.string(),                    // 展示字符串：计数为整数字符串，金额为 2 位小数字符串
  unit: z.enum(['count', 'money']),
})
export const SysHomeTrendSchema = z.object({
  dates: z.array(z.string()),           // 14 个 YYYY-MM-DD，按时间升序，缺数据的日期也要在
  series: z.array(z.object({
    key: z.enum(['orderCount', 'orderAmount']),
    unit: z.enum(['count', 'money']),
    data: z.array(z.number()),          // 与 dates 等长，缺日补 0
  })),
})
export const SysHomePieSchema = z.object({
  kind: z.enum(['orderStatus', 'balance']),
  items: z.array(z.object({ name: z.string(), value: z.number() })),
})
export const SysHomeOverviewRespSchema = z.object({
  scope: z.enum(['admin', 'self']),
  stats: z.array(SysHomeItemSchema),    // 3 项
  cards: z.array(SysHomeItemSchema),    // 6 项
  trend: SysHomeTrendSchema,
  pie: SysHomePieSchema,
  generatedAt: z.string(),
})

export type SysHomeItemDTO = z.infer<typeof SysHomeItemSchema>
export type SysHomeTrendDTO = z.infer<typeof SysHomeTrendSchema>
export type SysHomePieDTO = z.infer<typeof SysHomePieSchema>
export type SysHomeOverviewRespDTO = z.infer<typeof SysHomeOverviewRespSchema>
