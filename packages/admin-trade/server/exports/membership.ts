/**
 * 会员等级（开通 / 手工发放）的**对外稳定入口**。
 *
 * 两个入口区分得很清楚，别混：
 * - `openMemberLevel`：**用户购买 / 续费**。必须带 `requestId`（提交幂等键），
 *   服务端按等级价自动分三条通道：免费等级立即生效、余额支付同事务冻结+扣款、
 *   在线支付返回二维码三件套等待回调。返回的是**开通单**（`WP` / `OD` / `CL` / `FL`）。
 * - `grantMemberLevel`：**后台手工发放 / 调整**。不动钱（不开冻结、不扣余额、不写余额流水），
 *   只改会员档案并按需补一条 `pay_mode = 'manual'` 的开通留痕。
 *
 * 余额扣款的安全性（余额不足回滚、赠送金优先混扣、`level_open` 流水与商城消费区分）
 * 全部在 `MemberLevelOrderService` / `WalletService` 里，门面只做转发与参数校验。
 * 需要「关单 / 主动同步支付状态 / 查开通记录」时直接用 `memberLevelOrderService`。
 */

import { AppError } from '#admin/server/utils/appError'
import { useDb, type AppDb } from '#admin/server/drizzle/db'
import { memberService } from '#trade/server/trade-router/domain/member/MemberService'
import { memberLevelOrderService } from '#trade/server/trade-router/domain/member/MemberLevelOrderService'
import type { CreateLevelOrderResult } from '#trade/server/trade-router/domain/member/types'

export type { CreateLevelOrderInput, CreateLevelOrderResult } from '#trade/server/trade-router/domain/member/types'

/** 取执行器：与 `billing.ts` 同口径（tRPC 上下文带 `ctx.db`，脱离请求回落到连接池） */
function resolveDb(ctx: any): AppDb {
  return (ctx?.db ?? useDb()) as AppDb
}

/**
 * 开通 / 续费会员等级（购买链路）。
 *
 * 幂等：`requestId` 是**唯一**的提交幂等键（同一 `requestId` 只会落一张单，
 * 余额通道还用它做冻结业务号 `mlv:{requestId}`）。每次用户点击都要生成新的
 * `requestId`；重复提交同一个 `requestId` 返回原单（`reused: true`），不会重复扣款。
 * 因此**不要**用业务含义固定的值（如 `userId + levelId`）当 `requestId`。
 */
export async function openMemberLevel(ctx: any, input: {
  userId: string
  levelId: string
  /** 支付方式：balance 余额 / online 在线。免费等级由服务端固定为 free，传哪个都一样 */
  payMode: 'balance' | 'online'
  /** 提交幂等键（必填且非空：空值会让所有开通单共用同一个冻结业务号） */
  requestId: string
  /** 当前请求 origin：渠道未配 notify_url 时用于推导回调地址 */
  origin?: string | null
  notifyUrl?: string | null
  operatorId?: string | null
}): Promise<CreateLevelOrderResult> {
  const requestId = typeof input.requestId === 'string' ? input.requestId.trim() : ''

  if (!requestId) {
    throw new AppError('common.pleaseCheckValue', { message: 'requestId 不能为空' })
  }

  return await memberLevelOrderService(resolveDb(ctx)).create({
    userId: input.userId,
    levelId: input.levelId,
    payMode: input.payMode,
    requestId,
    origin: input.origin ?? null,
    notifyUrl: input.notifyUrl ?? null,
    operatorId: input.operatorId ?? null
  })
}

/**
 * 后台手工发放 / 调整会员等级（不动钱）。
 *
 * 期限优先级：目标等级是长期等级或 `longTerm = true` → 永久（`expireAt = null`）；
 * 显式传 `expireAt`（`null` = 清除到期）→ 用它；两者都没有 → 按等级 `durationDays` 推导。
 *
 * 留痕：只有「等级或到期时间确实变化」时才补一条 `manual` 开通记录，
 * 重复提交同一目标状态不会刷出一堆空单据；整个过程是一个事务，档案与留痕同生共死。
 */
export async function grantMemberLevel(ctx: any, input: {
  userId: string
  levelId: string
  /** 显式到期时间；`null` = 清除到期（等同长期）。不传则按目标等级时长推导 */
  expireAt?: string | null
  /** true = 长期（忽略 `expireAt`） */
  longTerm?: boolean
  remark?: string | null
  operatorId?: string | null
}): Promise<{
  userId: string
  levelId: string | null
  levelStartAt: string | null
  expireAt: string | null
  levelSource: string | null
}> {
  const db = resolveDb(ctx)
  const members = memberService(db)

  await members.changeLevel({
    userId: input.userId,
    levelId: input.levelId,
    ...(input.expireAt !== undefined ? { expireAt: input.expireAt } : {}),
    ...(input.longTerm !== undefined ? { longTerm: input.longTerm } : {}),
    ...(input.remark !== undefined ? { remark: input.remark } : {}),
    operatorId: input.operatorId ?? null
  })

  // changeLevel 已保证档案存在（否则抛 notFound）；这里回读是为了把有效期还给调用方
  const member = await members.getMember(input.userId)

  if (!member) {
    throw new AppError('module.system.member.notFound')
  }

  return {
    userId: member.userId,
    levelId: member.levelId ?? null,
    levelStartAt: member.levelStartAt ?? null,
    expireAt: member.expireAt ?? null,
    levelSource: member.levelSource ?? null
  }
}
