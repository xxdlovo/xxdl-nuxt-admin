/**
 * 渠道解析：把 sys_pay_channel 的一行（或环境变量兜底）变成适配器可直接使用的运行时配置。
 *
 * 凭证优先级：数据库渠道配置（状态启用）> 环境变量 NUXT_PAY_APP_ID / NUXT_PAY_APP_SECRET。
 * 这是为「凭证存放位置未定」预留的唯一改动点，其他代码不感知凭证来源。
 *
 * 数据访问全部走 repo/payChannelRepo（mapper 层），本文件只做「选哪个渠道 + 解密 + 拼运行时对象」。
 */
import { AppError } from '#server/utils/appError'
import type { AppExecutor } from '#server/drizzle/db'
import { decryptConfigSecrets } from './crypto'
import { getPayProvider } from './providers'
import { payChannelRepo, type PayChannelRow } from './repo/payChannelRepo'
import type { PayChannelRuntime } from './types'

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
export function toChannelRuntime(row: PayChannelRow): PayChannelRuntime {
  const provider = getPayProvider(row.channelCode)

  if (!provider) {
    throw new AppError('module.system.payChannel.providerUnsupported', {
      message: String(row.channelCode)
    })
  }

  const config = decryptConfigSecrets(provider.fields, asConfigRecord(row.config))

  return {
    id: row.id,
    configKey: row.configKey,
    configName: row.configName,
    channelCode: String(row.channelCode).trim().toLowerCase(),
    mode: row.mode,
    currency: row.currency,
    config,
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
  executor: AppExecutor,
  channelId?: string | null
): Promise<PayChannelRuntime> {
  if (!channelId) {
    const fallback = buildEnvFallbackChannel()
    if (fallback) {
      return fallback
    }
    throw new AppError('module.system.payChannel.notConfigured')
  }

  const row = await payChannelRepo(executor).findById(channelId)

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
  executor: AppExecutor,
  options: ResolvePayChannelOptions = {}
): Promise<PayChannelRuntime> {
  if (options.channelId) {
    return await getPayChannelRuntimeById(executor, options.channelId)
  }

  const row = await payChannelRepo(executor).findEnabled({
    channelCode: options.channelCode,
    currency: options.currency
  })

  if (row) {
    return toChannelRuntime(row)
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
export async function listEnabledChannelsByCode(executor: AppExecutor, channelCode: string): Promise<PayChannelRuntime[]> {
  const rows = await payChannelRepo(executor).listEnabledByCode(channelCode)

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
