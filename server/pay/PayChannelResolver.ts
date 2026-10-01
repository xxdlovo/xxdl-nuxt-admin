/**
 * 渠道解析：把 sys_pay_channel 的一行（或环境变量兜底）变成适配器可直接使用的运行时配置。
 *
 * 凭证优先级：数据库渠道配置（状态启用）> 环境变量 NUXT_PAY_APP_ID / NUXT_PAY_APP_SECRET。
 * 这是为「凭证存放位置未定」预留的唯一改动点，其他代码不感知凭证来源。
 */
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { sysPayChannel } from '#server/drizzle/schema'
import { AppError } from '#server/utils/appError'
import { decryptConfigSecrets } from './crypto'
import type { PayDb } from './db'
import { getPayProvider } from './providers'
import type { PayChannelRuntime } from './types'

type ChannelRow = typeof sysPayChannel.$inferSelect

export type ResolvePayChannelOptions = {
  channelId?: string | null
  channelCode?: string | null
  currency?: string | null
}

function asConfigRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

/** 渠道配置行 → 运行时配置（密钥已解密） */
export function toChannelRuntime(row: ChannelRow): PayChannelRuntime {
  const provider = getPayProvider(row.channelCode)

  if (!provider) {
    throw new AppError('module.system.payChannel.providerUnsupported', {
      message: String(row.channelCode)
    })
  }

  return {
    id: row.id,
    configKey: row.configKey,
    configName: row.configName,
    channelCode: String(row.channelCode).trim().toLowerCase(),
    mode: row.mode,
    currency: row.currency,
    config: decryptConfigSecrets(provider.fields, asConfigRecord(row.config)),
    notifyUrl: row.notifyUrl ?? null,
    returnUrl: row.returnUrl ?? null,
    cancelUrl: row.cancelUrl ?? null,
    orderTimeoutMinutes: row.orderTimeoutMinutes ?? 30,
    ipAllowlist: row.ipAllowlist ?? null
  }
}

/** 环境变量兜底渠道：只有配置了 APPID/SECRET 时才存在，库里没有渠道配置时使用 */
export function buildEnvFallbackChannel(): PayChannelRuntime | null {
  const appid = process.env.NUXT_PAY_APP_ID?.trim()
  const secret = process.env.NUXT_PAY_APP_SECRET?.trim()

  if (!appid || !secret) {
    return null
  }

  return {
    id: null,
    configKey: 'env:xunhupay',
    configName: 'env xunhupay',
    channelCode: 'xunhupay',
    mode: 'live',
    currency: 'CNY',
    config: {
      appid,
      secret,
      gateway: process.env.NUXT_PAY_GATEWAY?.trim() || 'https://api.xunhupay.com'
    },
    notifyUrl: process.env.NUXT_PAY_NOTIFY_URL?.trim() || null,
    returnUrl: null,
    cancelUrl: null,
    orderTimeoutMinutes: 30,
    ipAllowlist: null
  }
}

/** 按渠道配置行 id 取运行时配置（下单、查询、模拟回调都走这里） */
export async function getPayChannelRuntimeById(
  db: PayDb,
  channelId?: string | null
): Promise<PayChannelRuntime> {
  if (!channelId) {
    const fallback = buildEnvFallbackChannel()
    if (fallback) {
      return fallback
    }
    throw new AppError('module.system.payChannel.notConfigured')
  }

  const rows = await db
    .select()
    .from(sysPayChannel)
    .where(and(eq(sysPayChannel.id, channelId), eq(sysPayChannel.isDeleted, 0)))
    .limit(1)

  const row = rows[0]

  if (!row) {
    throw new AppError('common.notExist')
  }

  return toChannelRuntime(row)
}

/**
 * 选渠道：显式指定 id 优先，其次按 channelCode/currency 过滤，
 * 排序为「默认渠道优先 → sortOrder 升序 → 创建时间升序」。
 */
export async function resolvePayChannel(
  db: PayDb,
  options: ResolvePayChannelOptions = {}
): Promise<PayChannelRuntime> {
  if (options.channelId) {
    return await getPayChannelRuntimeById(db, options.channelId)
  }

  const conditions = [eq(sysPayChannel.isDeleted, 0), eq(sysPayChannel.status, 1)]

  if (options.channelCode) {
    conditions.push(eq(sysPayChannel.channelCode, options.channelCode.trim().toLowerCase()))
  }
  if (options.currency) {
    conditions.push(eq(sysPayChannel.currency, options.currency))
  }

  const rows = await db
    .select()
    .from(sysPayChannel)
    .where(and(...conditions))
    .orderBy(desc(sysPayChannel.isDefault), asc(sysPayChannel.sortOrder), asc(sysPayChannel.createdAt))
    .limit(1)

  if (rows[0]) {
    return toChannelRuntime(rows[0])
  }

  // 库里没有可用渠道时再看环境变量兜底（仅当没有指定渠道类型或指定的就是虎皮椒）
  const fallback = buildEnvFallbackChannel()
  if (fallback && (!options.channelCode || options.channelCode.trim().toLowerCase() === fallback.channelCode)) {
    return fallback
  }

  throw new AppError('module.system.payChannel.notConfigured')
}

/**
 * 回调路由用：同一个 channelCode 可能配置了多个账户，
 * 逐个验签，第一个通过的就是来源渠道。
 */
export async function listEnabledChannelsByCode(db: PayDb, channelCode: string): Promise<PayChannelRuntime[]> {
  const rows = await db
    .select()
    .from(sysPayChannel)
    .where(and(
      eq(sysPayChannel.isDeleted, 0),
      eq(sysPayChannel.status, 1),
      eq(sysPayChannel.channelCode, channelCode.trim().toLowerCase())
    ))
    .orderBy(desc(sysPayChannel.isDefault), asc(sysPayChannel.sortOrder), asc(sysPayChannel.createdAt))

  return rows
    .map(row => {
      try {
        return toChannelRuntime(row)
      } catch {
        // 未注册的渠道类型（例如历史遗留数据）跳过，不影响其他渠道验签
        return null
      }
    })
    .filter((channel): channel is PayChannelRuntime => channel !== null)
}

/** 渠道配置唯一性预检，给 Service 生成友好报错用 */
export async function findChannelByConfigKey(db: PayDb, configKey: string, excludeId?: string | null) {
  const rows = await db
    .select({ id: sysPayChannel.id })
    .from(sysPayChannel)
    .where(and(
      eq(sysPayChannel.configKey, configKey),
      eq(sysPayChannel.isDeleted, 0),
      excludeId ? sql`${sysPayChannel.id} <> ${excludeId}` : undefined
    ))
    .limit(1)

  return rows[0] ?? null
}
