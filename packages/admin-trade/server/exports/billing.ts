/**
 * 余额与交易的**对外稳定入口**。
 *
 * 宿主应用只需要这四个函数就能覆盖「扣钱 / 加钱 / 查余额 / 够不够」，
 * 不用了解 `WalletService` 的冻结状态机、幂等键、流水与批次台账。
 *
 * ── 一次性扣款 vs 两步（下单冻结 → 确认）──────────────────────────────────────
 * - **`chargeBalance`（一次性扣款）**：内部在**同一个事务**里 `freeze` + `confirm`，
 *   调用后余额立即减少且不可撤销。适合「钱已经确定要收」的场景：开通服务、扣次卡、
 *   结算一笔已经完成的业务。它按 `bizNo` 幂等，重复调用不会重复扣。
 * - **两步（`walletService(db).freeze` → `confirm` / `release`）**：适合「先占住钱、
 *   业务结果未定」的场景（商城下单 → 支付 → 发货，或在线支付等待渠道回调）。
 *   预扣期间钱只是被冻结（`frozen_*`），可用余额减少但余额没变；业务失败可 `release`
 *   原样退回。**需要订单/商品链路（库存、优惠码、支付渠道、履约）请直接用 `orderService`，
 *   不要自己用 chargeBalance 拼订单** —— 订单侧的冻结业务号是订单号，与这里的
 *   `bizNo` 是同一把唯一键，混用会互相占用。
 *
 * ── 三条硬约束（沿用领域层，不在门面里另立规矩）──────────────────────────────
 * 1. **余额扣款不会创建订单**：`chargeBalance` 只动钱包（余额 + 流水 + 赠送金批次），
 *    不写 `sys_member_order`、不扣库存、不核销优惠码。需要订单语义请用 `orderService`。
 * 2. **幂等靠唯一索引，不靠内存**：`bizNo` → 冻结单 `uk_member_freeze_biz`；
 *    流水 `dedup_key`（`bizType:bizNo:account`）。命中即返回首次结果（`reused: true`），
 *    余额不变。`bizNo` 是**全局唯一键**（不按用户隔离），因此必须是调用方自己的业务单号。
 * 3. **余额不会被扣成负数**：冻结是带守卫的条件更新，余额不足抛
 *    `module.system.member.balanceInsufficient`，且**不做任何写入**（整事务回滚）。
 *
 * 金额一律「元 + 两位小数字符串」：`normalizeMoney` 归一（接受 number 与 `"12"`），
 * 非法/非正/超上限沿用既有业务错误（`amountInvalid` / `amountTooLarge`）。
 */

import { AppError } from '#admin/server/utils/appError'
import { useDb, type AppDb } from '#admin/server/drizzle/db'
import {
  walletService,
  walletServiceIn
} from '#trade/server/trade-router/domain/wallet/WalletService'
import { rechargeService } from '#trade/server/trade-router/domain/wallet/RechargeService'
import { orderService } from '#trade/server/trade-router/domain/order/OrderService'
import { memberService } from '#trade/server/trade-router/domain/member/MemberService'
import {
  memberLevelOrderService,
  memberLevelOrderServiceIn
} from '#trade/server/trade-router/domain/member/MemberLevelOrderService'
import { addMoney, compareMoney, normalizeMoney } from '#trade/server/trade-router/domain/wallet/utils'
import type { WalletBizType, WalletSnapshot } from '#trade/server/trade-router/domain/wallet/types'

// 领域服务工厂原样透出：门面覆盖 90% 场景，剩下的（两步冻结、对账、订单链路、
// 手工调账、优惠码、开通单同步）直接拿工厂用，不需要再深挖内部路径。
export {
  walletService,
  walletServiceIn,
  rechargeService,
  orderService,
  memberService,
  memberLevelOrderService,
  memberLevelOrderServiceIn
}

export type { WalletBizType }

/** 余额快照（字段全部来自真实钱包行，`available = 余额 - 冻结`） */
export type BalanceSnapshot = {
  recharge: string
  gift: string
  frozenRecharge: string
  frozenGift: string
  availableRecharge: string
  availableGift: string
}

/**
 * `credit`（入账）只接受这几种业务类型：它们描述「钱的来源」。
 * `WalletBizType` 里 `consume_confirm` / `level_open` / `gift_expire` 是**扣款**语义，
 * 放进入账流水会让「余额 = Σ(in) − Σ(out)」的账实等式与统计口径都失真。
 */
const CREDIT_BIZ_TYPES = ['recharge', 'register_bonus', 'gift_system', 'gift_campaign', 'adjust'] as const

type CreditBizType = (typeof CREDIT_BIZ_TYPES)[number]

function isCreditBizType(value: string): value is CreditBizType {
  return (CREDIT_BIZ_TYPES as readonly string[]).includes(value)
}

/** 取当前请求的数据库执行器：tRPC / Nitro 上下文带 `ctx.db`，脱离请求（脚本、任务）回落到连接池 */
function resolveDb(ctx: any): AppDb {
  return (ctx?.db ?? useDb()) as AppDb
}

/** 幂等键不能为空：空 `bizNo` 会让所有扣款命中同一条冻结单（等于互相顶掉） */
function assertKey(value: string, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError('common.pleaseCheckValue', { message: `${label} 不能为空` })
  }

  return value.trim()
}

/** 钱包快照 → 对外快照：字段直接取自领域层算好的 `WalletSnapshot`，门面不另算口径 */
function toBalanceSnapshot(snapshot: WalletSnapshot): BalanceSnapshot {
  return {
    recharge: snapshot.rechargeBalance,
    gift: snapshot.giftBalance,
    frozenRecharge: snapshot.frozenRecharge,
    frozenGift: snapshot.frozenGift,
    availableRecharge: snapshot.availableRecharge,
    availableGift: snapshot.availableGift
  }
}

/**
 * 读余额快照（无钱包返回 null）。
 *
 * 先 `findWallet` 判存在性：`getWallet` 对「没有钱包行」返回的是**空快照**（不是 null），
 * 单看它无法区分「没钱包」与「钱包是 0 元」。两次查询里只有已存在钱包时才会走第二条。
 */
async function readBalanceSnapshot(
  wallet: ReturnType<typeof walletServiceIn>,
  userId: string
): Promise<BalanceSnapshot | null> {
  const row = await wallet.findWallet(userId)

  if (!row) {
    return null
  }

  return toBalanceSnapshot(await wallet.getWallet(userId))
}

/**
 * `WalletService` 内部的 `AlreadyAppliedError` 没有导出，跨模块只能按 `name` 识别
 * （与 `MemberLevelOrderService.recoverByRequestId` 同一约定）。
 * 它只说明「撞了唯一键」，**不**证明这笔业务已经落库。
 */
function isAlreadyApplied(error: unknown): boolean {
  return error instanceof Error && error.name === 'AlreadyAppliedError'
}

/**
 * 幂等键归属校验：`bizNo` 是全局唯一键（`uk_member_freeze_biz`），
 * 已被别的用户 / 别的金额占用时必须拒绝。
 *
 * 否则重复调用会「确认别人的冻结单」并把对方的余额当作本次结果返回（跨用户串账），
 * 或按首次金额扣款却谎报成本次金额。
 */
function assertFreezeReusable(
  freeze: { bizNo: string, userId: string, amount: string },
  input: { userId: string, amount: string }
): void {
  if (freeze.userId !== input.userId || compareMoney(freeze.amount, input.amount) !== 0) {
    throw new AppError('system.repeatSubmit', {
      message: `bizNo ${freeze.bizNo} 已被 ${freeze.amount} 的扣款占用`
    })
  }
}

/** 单次余额扣款（内部 freeze + confirm 同事务，立即生效、不可撤销；按 bizNo 幂等） */
export async function chargeBalance(ctx: any, input: {
  userId: string
  amount: string
  bizNo: string
  bizType?: WalletBizType
  reason?: string | null
  operatorId?: string | null
}): Promise<{ freezeId: string, amount: string, reused: boolean, balance: BalanceSnapshot }> {
  const db = resolveDb(ctx)
  const userId = assertKey(input.userId, 'userId')
  const bizNo = assertKey(input.bizNo, 'bizNo')
  // 非法金额在**任何写入之前**抛出（normalizeMoney 同时做「两位小数 / 正数 / 上限」校验）
  const amount = normalizeMoney(input.amount)
  const bizType: WalletBizType = input.bizType ?? 'consume_confirm'
  const operatorId = input.operatorId ?? null

  try {
    /**
     * 一个事务里完成「预扣 → 确认」：
     * - 预扣：`freeze` 先按 `bizNo` 回读，命中就返回首次结果（不重复占用）；
     *   插入撞 `uk_member_freeze_biz` 时事务回滚，由下面的 catch 回读确认；
     * - 确认：`confirm` 先看冻结单状态，`CONFIRMED` 直接按 reused 返回；
     *   写流水撞 `dedup_key` 时事务回滚（AlreadyAppliedError），同样由 catch 回读。
     * 两者同事务的收益：不会留下「冻了钱但没确认」的悬挂冻结单（`ttlMinutes = 0`
     * 不设过期，悬挂后只能人工释放）。
     */
    return await db.transaction(async (tx) => {
      const wallet = walletServiceIn(tx)

      const frozen = await wallet.freeze({
        userId,
        bizNo,
        amount,
        subject: input.reason ?? null,
        // 0 = 不设过期：本函数紧接着确认，释放权只归本事务
        ttlMinutes: 0,
        operatorId
      })

      if (frozen.reused) {
        // 幂等命中：必须核实「凭据」确实存在，并确认这次请求与首次是同一笔钱
        const existing = await wallet.findFreezeByBizNo(bizNo)

        if (!existing) {
          throw new AppError('module.system.member.freezeNotFound')
        }

        assertFreezeReusable(existing, { userId, amount })
      }

      const settled = await wallet.confirm({ freezeId: frozen.freezeId, bizType, operatorId })

      const balance = await readBalanceSnapshot(wallet, userId)

      if (!balance) {
        // 冻结/确认都成功却读不到钱包行：数据异常，回滚并明确报错（不要返回假快照）
        throw new AppError('module.system.member.walletNotFound')
      }

      return {
        freezeId: frozen.freezeId,
        amount: frozen.amount,
        reused: frozen.reused || settled.reused,
        balance
      }
    })
  } catch (error) {
    // 并发撞唯一键：本次事务已回滚，去回读冻结单判断「是不是已经扣过了」
    if (!isAlreadyApplied(error)) {
      throw error
    }

    const existing = await walletServiceIn(db).findFreezeByBizNo(bizNo)

    // 查不到凭据 → 无法确认这笔业务是否生效，原样抛出（绝不返回 reused: true 假成功）
    if (!existing) {
      throw error
    }

    assertFreezeReusable(existing, { userId, amount })

    if (existing.status === 'FROZEN') {
      /**
       * 同一个 `bizNo` 只有一张冻结单，且它仍处于冻结中：说明这条业务单正被**别的链路**
       * 处理（并发扣款，或订单侧的「下单冻结」）。既不能替别人确认，也不能谎报扣款成功，
       * 本次返回「重复提交」让调用方稍后重试（重试会命中幂等分支）。
       */
      throw new AppError('system.repeatSubmit', { message: `bizNo ${existing.bizNo} 正在处理中` })
    }

    // RELEASED / EXPIRED：这张冻结单已经作废，本次不是一笔有效扣款 → 明确拒绝，钱没扣
    if (existing.status !== 'CONFIRMED') {
      throw new AppError('module.system.member.freezeNotFrozen')
    }

    const balance = await readBalanceSnapshot(walletServiceIn(db), userId)

    if (!balance) {
      throw error
    }

    return { freezeId: existing.id, amount: existing.amount, reused: true, balance }
  }
}

/** 余额入账（充值/补偿/退款）；按 bizNo 幂等 */
export async function creditBalance(ctx: any, input: {
  userId: string
  amount: string
  bizNo: string
  account?: 'recharge' | 'gift'
  bizType?: WalletBizType
  reason?: string | null
  operatorId?: string | null
}): Promise<{ reused: boolean, balance: BalanceSnapshot }> {
  const userId = assertKey(input.userId, 'userId')
  const bizNo = assertKey(input.bizNo, 'bizNo')
  const amount = normalizeMoney(input.amount)
  const account = input.account ?? 'recharge'
  const bizType: WalletBizType = input.bizType ?? 'recharge'

  if (!isCreditBizType(bizType)) {
    throw new AppError('common.pleaseCheckValue', { message: `bizType ${bizType} 不能用于入账` })
  }

  /**
   * 入账直接走 `walletService(db).credit`：
   * - 幂等：`dedup_key`（`bizType:bizNo:account`）唯一，命中即 reused；
   *   赠送金还有 `uk_member_gift_biz`（批次业务号）作为第二道闸门；
   * - 撞唯一键时领域层会**核实凭据**再返回 reused，核实不到就原样抛错。
   */
  const result = await walletService(resolveDb(ctx)).credit({
    userId,
    account,
    amount,
    bizType,
    bizNo,
    reason: input.reason ?? null,
    operatorId: input.operatorId ?? null
  })

  const balance = await getBalance(ctx, userId)

  if (!balance) {
    throw new AppError('module.system.member.walletNotFound')
  }

  return { reused: result.reused, balance }
}

/** 读余额快照（无钱包返回 null） */
export async function getBalance(ctx: any, userId: string): Promise<BalanceSnapshot | null> {
  return await readBalanceSnapshot(walletServiceIn(resolveDb(ctx)), assertKey(userId, 'userId'))
}

/**
 * 断言余额充足（不足抛既有 `module.system.member.balanceInsufficient`；不足时不做任何写入）。
 *
 * 判定口径与冻结完全一致：可用 = 可用充值金 + 可用赠送金（即 `余额 - 冻结`），
 * 因为 `freeze` 会先花赠送金、不足再落充值金。纯读，不会建钱包、不会冻结。
 *
 * 注意这是**预检**，不是锁：检查通过后到真正扣款之间余额仍可能被别人花掉，
 * 真正的防线是 `chargeBalance` / `freeze` 里带守卫的条件更新。
 */
export async function assertBalance(ctx: any, userId: string, amount: string): Promise<void> {
  const normalized = normalizeMoney(amount)
  const snapshot = await getBalance(ctx, userId)
  const available = snapshot
    ? addMoney(snapshot.availableRecharge, snapshot.availableGift)
    : '0.00'

  if (compareMoney(available, normalized) < 0) {
    throw new AppError('module.system.member.balanceInsufficient')
  }
}

