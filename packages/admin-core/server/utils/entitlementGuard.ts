/**
 * 服务端能力（功能开关 / 配额）守卫。
 *
 * 数据来源是 `ctx.entitlements`：由 auth 中间件按请求解析一次并注入
 * （见 server/trpc/middlewares/auth.ts），本文件只做判定，不再查数据源。
 *
 * 判定原则：
 * - 未登录：401（沿用既有 auth.unauthorized，不在这里记能力告警）；
 * - 管理员：默认绕过，除非该能力在 meta 里显式 `adminBypass: false`；
 * - 能力未在目录（meta）登记：拒绝（fail-closed），便于发现键名拼错；
 * - switch：值非 1 拒绝；
 * - quota：UNLIMITED 通过；否则按 `meta.resolverKey ?? key` 找计量器得到 used，
 *   `used + delta > 上限` 拒绝；
 * - quota 但缺少计量器且调用方没传 used：拒绝（fail-closed，不能把未知用量当 0）。
 *
 * 所有能力拒绝都经 `deny()` 统一记一条 warn 日志再抛 AppError。
 */

import { AppError } from '#admin/server/utils/appError'
import { resolveLogger } from '#admin/server/utils/evlogLogger'
import {
  isSwitchOn,
  isUnlimited,
  quotaOf,
} from '#admin/shared/entitlement/types'
import type { EntitlementProfile } from '#admin/shared/entitlement/types'

/** 配额计量器：返回当前已用数量（可同步或异步）。 */
export type EntitlementUsageResolver = (ctx: any, userId: string) => Promise<number> | number

/** 能力键 → 计量器；上层（trade）在启动时注册（如 classCount = 统计当前用户班级数）。 */
const usageResolvers = new Map<string, EntitlementUsageResolver>()

const DENIED_KEY = 'module.system.entitlement.denied'
const QUOTA_EXCEEDED_KEY = 'module.system.entitlement.quotaExceeded'

/** 注册配额计量器（如 classCount = 统计当前用户班级数）；重复注册以最后一次为准 */
export function registerEntitlementResolver(resolverKey: string, fn: EntitlementUsageResolver): void {
  usageResolvers.set(resolverKey, fn)
}

/** 已注册的计量器键列表（诊断 / 启动自检用）。 */
export function listEntitlementResolvers(): string[] {
  return Array.from(usageResolvers.keys())
}

/** 读取能力原始数值；未登录或未注入能力档案时按 0 处理。 */
export function getEntitlement(ctx: any, key: string): number {
  return quotaOf(ctx?.entitlements?.features?.[key])
}

/**
 * 统一拒绝出口：先记 warn，再抛业务错误。
 *
 * @param reason 稳定原因码，写进日志便于排查（unregistered / switchOff / quotaExceeded / resolverMissing）
 * @param extra 额外日志字段（如实际使用的 resolverKey），只写日志，不影响错误响应
 */
function deny(
  ctx: any,
  key: string,
  reason: string,
  i18nKey: string,
  message: string,
  extra: Record<string, unknown> = {}
): never {
  const log = resolveLogger('server/utils/entitlementGuard')
  log.warn('entitlement denied', {
    entitlement: {
      action: 'assertEntitlement',
      key,
      reason,
      userId: ctx?.user?.id ?? null,
      ...extra
    }
  })

  throw new AppError(i18nKey, { message })
}

/** 只能给端用户看的提示：隐藏功能不暴露具体上限。 */
function quotaMessage(value: number, unit?: string | null): string {
  return unit ? `该功能上限 ${value}（${unit}）` : `该功能上限 ${value}`
}

/**
 * 校验能力：读 ctx.entitlements，按 kind 判定。
 *
 * @param options.delta 本次操作增加的用量，默认 1
 * @param options.used 调用方已知的当前用量；不传则用注册的计量器
 */
export async function assertEntitlement(
  ctx: any,
  key: string,
  options?: { delta?: number; used?: number }
): Promise<void> {
  const user = ctx?.user

  if (!user) {
    throw new AppError('auth.unauthorized')
  }

  const profile: EntitlementProfile | undefined = ctx?.entitlements ?? undefined
  const meta = profile?.meta?.[key]

  // 没登记的能力一律拒绝：既防止键名拼错后静默放行，也避免管理员绕过未定义能力
  if (!meta) {
    deny(ctx, key, 'unregistered', DENIED_KEY, '当前操作不可用')
  }

  const adminBypass = meta.adminBypass !== false
  if (user.isAdmin === 1 && adminBypass) {
    return
  }

  const value = quotaOf(profile?.features?.[key])

  if (meta.kind === 'switch') {
    if (!isSwitchOn(value)) {
      deny(ctx, key, 'switchOff', DENIED_KEY, '当前操作不可用')
    }

    return
  }

  if (isUnlimited(value)) {
    return
  }

  const delta = options?.delta ?? 1

  let used = options?.used
  if (used === undefined) {
    // 计量器键默认就是功能键；目录可让多个功能共用一个计量器，
    // 因此优先用 meta.resolverKey（如 student.max / student.export 共用 studentCount）
    const resolverKey = meta.resolverKey ?? key
    const resolver = usageResolvers.get(resolverKey)
    if (!resolver) {
      // 没有计量器就拿不到真实用量，不能按 0 放行，否则配额形同虚设
      deny(ctx, key, 'resolverMissing', DENIED_KEY, '当前操作不可用', { resolverKey })
    }

    used = await resolver(ctx, user.id)
  }

  if (used + delta > value) {
    const i18nKey = meta.userShow ? QUOTA_EXCEEDED_KEY : DENIED_KEY
    const message = meta.userShow
      ? quotaMessage(value, meta.unit)
      : '当前操作不可用'

    deny(ctx, key, 'quotaExceeded', i18nKey, message)
  }
}
