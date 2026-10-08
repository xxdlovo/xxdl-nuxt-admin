/**
 * 会员等级开通域服务（购买 / 续费 / 生效 / 主动同步）。
 *
 * 三个支付通道（规则 5）：
 * - `price = 0`（免费等级）：**不生成支付单、不扣款**，落单即 `OD`（`payMode = 'free'`、
 *   `payAmount = '0.00'`）并立即生效；
 * - `balance`：**同一事务**内「落单 WP → 余额冻结 → 确认扣款 → 单据 OD → 等级生效」，
 *   复用 `WalletService` 的 `freeze` + `confirm`；确认流水用 `bizType = 'level_open'`
 *   （「等级购买」与商城消费 `consume_confirm` 可区分）并计入 `total_consume`，
 *   赠送金优先混扣走 freeze 的默认拆分；余额不足抛 `module.system.member.balanceInsufficient`，
 *   整事务回滚（不落单、不扣款）；
 * - `online`：事务外调 `payOrderService(...).createPayment`（`bizType = memberLevel`），
 *   成功后回填支付单信息并返回二维码三件套；失败把单据置 `FL`（**不动余额**）。
 *
 * 生效规则（规则 4，`myOpenLevel` 与支付回调共用 `computeLevelEffect` / `writeLevelEffect`）：
 * - 长期等级 → `expireAt = NULL`、`levelSource = 'open'`；
 * - 同等级续费 → `expireAt = max(now, 当前 expireAt) + durationDays`、`levelSource = 'renew'`；
 * - 不同等级 → 立即生效且剩余期限清空：`expireAt = now + durationDays`、`levelSource = 'upgrade'`。
 *
 * 幂等（同一单据只生效一次）：
 * 1. `uk_member_level_order_request`（`request_id` 唯一）：同一提交只落一单 ——
 *    入口先按 requestId 回读；落单撞唯一键时回读原单并按幂等返回，绝不抛内部错误；
 * 2. `uk_member_level_order_out`（out_trade_no 唯一）；
 * 3. 生效闸门 `markPaid` 的条件更新 `status = 'WP' → 'OD'`（affectedRows = 0 视为并发已生效）；
 * 4. 等级写回与闸门同事务，闸门失败即回滚，不会出现「单据 OD、等级没写」或重复顺延；
 * 5. 余额支付的冻结业务号 `mlv:{requestId}` 唯一（`uk_member_freeze_biz`）：
 *    同一事务内的第二道真幂等，同一 requestId 只可能冻结/扣款一次。
 */
import { AppError } from '#server/utils/appError'
import { isDuplicateKeyError } from '#server/utils/dbError'
import { resolveLogger } from '#server/utils/evlogLogger'
import { type AppDb, type AppExecutor, type AppTx } from '#server/drizzle/db'
import { randomUuid } from '#shared/utils/uuid'
import { PAY_BIZ_TYPE_MEMBER_LEVEL } from '../pay/PaidHandlers'
import { payOrderService } from '../pay/PayOrderService'
import { payChannelRepo, type PayChannelRow } from '../pay/repo/payChannelRepo'
import { addMinutes, buildOutTradeNo, nowForMysql, toErrorMessage, truncateText } from '../pay/utils'
import { walletServiceIn } from '../wallet/WalletService'
import { toCents } from '../wallet/utils'
import { levelRepo, type LevelRow } from './repo/levelRepo'
import { levelOrderRepo, type LevelOrderRow } from './repo/levelOrderRepo'
import { memberRepo } from './repo/memberRepo'
import { resolveLevelOpenDecision } from './levelOpenPolicy'
import type {
  CreateLevelOrderInput,
  CreateLevelOrderResult,
  LevelEffectResult,
  LevelOrderStatus,
  LevelOrderStatusResult,
  MarkLevelPaidResult,
  MemberLevelSource
} from './types'

/** 在线支付单据的支付窗口（分钟）：超时后重复提交会另开一单，旧单被关闭 */
const LEVEL_ORDER_TTL_MINUTES = 30

const STATUS_PENDING: LevelOrderStatus = 'WP'
const STATUS_ACTIVE: LevelOrderStatus = 'OD'
const STATUS_CLOSED: LevelOrderStatus = 'CL'

/**
 * 余额支付的冻结业务号前缀：`mlv:{requestId}`。
 *
 * 单据表已有 `request_id` 唯一键（`uk_member_level_order_request`）作为主幂等闸门，
 * 这里的冻结业务号是**同事务内的第二道真幂等**：即使单据侧因极端情况重复落单，
 * 同一 requestId 也只会冻结/扣款一次（`uk_member_freeze_biz` 命中即返回首次结果）。
 */
const FREEZE_BIZ_PREFIX = 'mlv:'

/** 等级生效计划（先算后写：让单据的 startAt / endAt 与会员档案一致） */
type LevelEffectPlan = {
  startAt: string
  endAt: string | null
  levelSource: Extract<MemberLevelSource, 'open' | 'renew' | 'upgrade'>
}

/** 并发下单据已被别的请求推进：抛出以回滚本事务，外层按「已生效」返回 */
class LevelOrderSettledError extends Error {
  constructor() {
    super('member level order already settled')
    this.name = 'LevelOrderSettledError'
  }
}

export function isLevelOrderSettled(error: unknown): boolean {
  return error instanceof LevelOrderSettledError
}

function toStatus(value: string | null | undefined): LevelOrderStatus {
  return (value ?? STATUS_PENDING) as LevelOrderStatus
}

/** 'YYYY-MM-DD HH:mm:ss'（本地墙钟，与 MySQL 同处一个时区）→ Date；绝不用 toISOString 反向格式化 */
function mysqlToDate(value: string): Date {
  return new Date(String(value).replace(' ', 'T'))
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

/** 单据行 → 发起结果（二维码信息由调用方补） */
function toCreateResult(
  row: LevelOrderRow,
  extra: { qrImageUrl?: string | null, qrContent?: string | null, payUrl?: string | null, reused?: boolean } = {}
): CreateLevelOrderResult {
  return {
    orderId: row.id,
    outTradeNo: row.outTradeNo,
    status: toStatus(row.status),
    levelId: row.levelId,
    levelName: row.levelName,
    payMode: row.payMode as CreateLevelOrderResult['payMode'],
    priceAmount: row.priceAmount,
    payAmount: row.payAmount,
    expireAt: row.expireAt ?? null,
    effectiveAt: row.effectiveAt ?? null,
    endAt: row.endAt ?? null,
    qrImageUrl: extra.qrImageUrl ?? null,
    qrContent: extra.qrContent ?? null,
    payUrl: extra.payUrl ?? null,
    reused: extra.reused ?? false
  }
}

function toStatusResult(row: LevelOrderRow): LevelOrderStatusResult {
  return {
    outTradeNo: row.outTradeNo,
    status: toStatus(row.status),
    failReason: row.failReason ?? null,
    effectiveAt: row.effectiveAt ?? null,
    endAt: row.endAt ?? null
  }
}

function toMarkPaidResult(row: LevelOrderRow, reused: boolean): MarkLevelPaidResult {
  return {
    orderId: row.id,
    outTradeNo: row.outTradeNo,
    status: toStatus(row.status),
    levelId: row.levelId,
    levelName: row.levelName,
    reused,
    effectiveAt: row.effectiveAt ?? null,
    endAt: row.endAt ?? null
  }
}

/**
 * 事务内能力：只使用传入的 executor（`AppTx` 或 `AppDb`）。
 * 渠道网络调用（在线支付下单）刻意留在外层，避免把事务拉长。
 */
export function buildMemberLevelOrder(executor: AppExecutor) {
  const repo = levelOrderRepo(executor)
  const levels = levelRepo(executor)
  const members = memberRepo(executor)
  const wallet = walletServiceIn(executor)
  // 领域服务没有 ctx：用 resolveLogger 从当前请求上下文取 logger（脱离请求时自动降级为空实现）。
  // 只记写操作，读方法由上层模块服务的日志覆盖。
  const log = resolveLogger('server/trade-router/memberLevelOrder')

  /** 等级必须存在且启用（下单时判定；已支付单据的生效不受等级后续停用影响） */
  async function getLevelOrThrow(levelId: string): Promise<LevelRow> {
    const level = await levels.findById(levelId)

    if (!level || Number(level.status) !== 1) {
      throw new AppError('module.system.member.levelNotAvailable')
    }

    return level
  }

  /**
   * 计算等级生效结果（只读，不写库）。
   *
   * `isLongTerm` 同时看等级当前配置与单据快照：只要等级是长期等级、
   * 或快照时长为 0，就按长期处理（规则 1 的硬约束：长期等级会员永不过期）。
   */
  async function computeLevelEffect(input: {
    userId: string
    levelId: string
    durationDays: number
    isLongTerm: boolean
    now: string
  }): Promise<LevelEffectPlan> {
    const member = await members.findByUserId(input.userId)

    if (!member) {
      throw new AppError('module.system.member.notFound')
    }

    if (input.isLongTerm) {
      return { startAt: input.now, endAt: null, levelSource: 'open' }
    }

    if (member.levelId === input.levelId) {
      /**
       * 同等级续费：`max(now, 当前 expireAt) + durationDays`。
       * 时间字符串是 'YYYY-MM-DD HH:mm:ss'，字典序即时间序，可以直接比大小。
       */
      const base = member.expireAt && member.expireAt > input.now ? member.expireAt : input.now

      return {
        // 续费只是把到期时间往后顺延，等级生效起点保持原值（没有则记本次）
        startAt: member.levelStartAt ?? input.now,
        endAt: nowForMysql(addDays(mysqlToDate(base), input.durationDays)),
        levelSource: 'renew'
      }
    }

    // 升级/降级：立即生效，剩余期限清空
    return {
      startAt: input.now,
      endAt: nowForMysql(addDays(mysqlToDate(input.now), input.durationDays)),
      levelSource: 'upgrade'
    }
  }

  /** 把生效结果写回会员档案（`levelStartAt` / `expireAt` / `levelSource` / `levelChangedAt`） */
  async function writeLevelEffect(input: {
    userId: string
    levelId: string
    plan: LevelEffectPlan
    now: string
    operatorId: string | null
  }): Promise<LevelEffectResult> {
    // 等级改名不影响已落单快照，这里只取当前名称用于返回信息
    const level = await levels.findById(input.levelId)
    const affected = await members.changeLevel({
      userId: input.userId,
      levelId: input.levelId,
      changedAt: input.now,
      startAt: input.plan.startAt,
      expireAt: input.plan.endAt,
      levelSource: input.plan.levelSource,
      operatorId: input.operatorId
    })

    // 条件更新未命中说明档案不存在/被删：抛错回滚整单，避免「单据生效但等级没写」
    if (affected === 0) {
      throw new AppError('module.system.member.notFound')
    }

    return {
      levelId: input.levelId,
      levelName: level?.name ?? '',
      startAt: input.plan.startAt,
      endAt: input.plan.endAt,
      levelSource: input.plan.levelSource
    }
  }

  /**
   * 后台「会员管理」手工调整等级 / 期限的**留痕单**（`pay_mode = 'manual'`，落 `OD`）。
   *
   * 为什么落这里而不是余额流水：手工调整**不动钱**，往 `sys_member_balance_log` 写任何一条
   * 都会破坏「余额 = Σ流水」的账实等式；而「会员开通记录」本身是等级变动台账，正合适。
   *
   * 调用约定（见 `MemberService.changeLevel` / `onboard`）：
   * - **必须由调用方在自身事务内调用**（`memberLevelOrderServiceIn(tx)`），让留痕与改档案同生共死；
   *   因此本方法只挂在事务内版本上，`memberLevelOrderService(db)` 刻意不暴露它。
   * - 只由「后台手工开通 / 手工调整」触发，**不用于**注册自动分配默认等级（`levelSource = 'default'`）、
   *   到期自动降级（`levelSource = 'auto_expire'`）、以及只改备注/状态的操作 ——
   *   这三类都不是「开通/续费」行为，写进来只会污染开通记录。
   *
   * 时间字段口径：`startAt` / `endAt` 与写回 `sys_member` 的 `level_start_at` / `expire_at` 完全一致
   * （长期等级 `end_at = NULL`），`paid_at` / `effective_at` 记本次生效时刻
   * （手工调整没有「支付时间」，但 OD 单的时间字段要自洽，便于按时间轴排查）。
   */
  async function recordManualTx(input: {
    userId: string
    /** 调整后的目标等级（名称 / 时长快照按此等级的当前配置取） */
    levelId: string
    /** 调整后的等级生效开始时间（= 写回的 sys_member.level_start_at） */
    startAt: string
    /** 调整后的等级到期时间；null = 长期/永不过期（= 写回的 sys_member.expire_at） */
    endAt: string | null
    /** 后台调整原因（写 remark），由调用方给文案 */
    remark: string
    operatorId: string | null
  }): Promise<{ orderId: string, outTradeNo: string }> {
    /**
     * 这里只校验「等级存在」，**不重复做启用判定**：调用方（会员档案侧）已经按
     * `MemberService.isActiveStatus` 的口径放行过本次调整，而 `getLevelOrThrow` 用的是更严的
     * `status === 1`（把 status 为 NULL 的等级视为不可用）。两处判据不一致会让「档案改成功、
     * 留痕抛错」把整笔事务回滚，属行为倒退；等级状态该由档案侧一处说了算。
     */
    const level = await levels.findById(input.levelId)

    if (!level) {
      throw new AppError('module.system.member.levelNotAvailable')
    }

    const orderId = randomUuid()
    const outTradeNo = buildOutTradeNo('MLV')
    const now = nowForMysql()
    const isLongTerm = Number(level.isLongTerm) === 1 || Number(level.durationDays) <= 0

    await repo.insertManual({
      id: orderId,
      outTradeNo,
      userId: input.userId,
      levelId: level.id,
      levelName: level.name,
      durationDays: isLongTerm ? 0 : Math.max(1, Math.floor(Number(level.durationDays) || 0)),
      startAt: input.startAt,
      // 长期等级恒为 NULL：即便调用方传了值也不落库（规则 1 的硬约束）
      endAt: isLongTerm ? null : input.endAt,
      paidAt: now,
      effectiveAt: now,
      remark: truncateText(input.remark, 255),
      operatorId: input.operatorId
    })

    log.info('memberLevelOrder manual record created', {
      memberLevelOrder: { action: 'recordManualTx', id: orderId, userId: input.userId, levelId: level.id }
    })

    return { orderId, outTradeNo }
  }

  /**
   * 开通 / 续费的**权威硬校验**（落单前调用）。
   *
   * 前端置灰只是体验，这里才是唯一防线：规则与 `sysMember.myLevelOptions` 返回的
   * `canOpen` / `blockedReason` 同源（`levelOpenPolicy.resolveLevelOpenDecision`），
   * 因此不会出现「接口说不能开通、落单却放行」的漂移。
   *
   * 命中即抛业务错误（前端 toast 直接展示对应文案）：
   * - `module.system.memberLevelOrder.freeAlreadyOpened`：0 元等级已激活或已有过免费成功单据；
   * - `module.system.memberLevelOrder.longTermActive`：长期等级已激活。
   *
   * 付费等级的续费（同等级）与升级（异等级）不受影响。
   */
  async function assertLevelOpenAllowed(input: {
    userId: string
    level: LevelRow
    /** 是否长期等级（`is_long_term = 1` 或 `duration_days <= 0`），由调用方按领域口径传入 */
    isLongTerm: boolean
  }): Promise<void> {
    const member = await members.findByUserId(input.userId)
    const now = nowForMysql()
    // 只在免费等级上查「免费成功单据」，付费等级少一次查询（规则内部也只在免费分支读它）
    const isFree = toCents(String(input.level.price ?? '0.00')) === 0
    const hasFreePaidOrder = isFree
      ? await repo.existsFreePaidOrder(input.userId, input.level.id)
      : false
    const decision = resolveLevelOpenDecision({
      levelId: input.level.id,
      price: input.level.price,
      isLongTerm: input.isLongTerm,
      currentLevelId: member?.levelId ?? null,
      expireAt: member?.expireAt ?? null,
      now,
      hasFreePaidOrder
    })

    if (decision.blockedReason === 'freeAlreadyOpened') {
      throw new AppError('module.system.memberLevelOrder.freeAlreadyOpened')
    }

    if (decision.blockedReason === 'longTermActive') {
      throw new AppError('module.system.memberLevelOrder.longTermActive')
    }
  }

  /** 免费等级：落单 → 立即生效（`payMode = 'free'`、不生成支付单、不扣款） */
  async function createFreeTx(input: {
    userId: string
    level: LevelRow
    requestId: string
    durationDays: number
    isLongTerm: boolean
    operatorId: string | null
  }): Promise<CreateLevelOrderResult> {
    const orderId = randomUuid()
    const outTradeNo = buildOutTradeNo('MLV')
    const now = nowForMysql()

    await repo.insert({
      id: orderId,
      outTradeNo,
      requestId: input.requestId,
      userId: input.userId,
      levelId: input.level.id,
      levelName: input.level.name,
      durationDays: input.durationDays,
      priceAmount: input.level.price,
      payAmount: '0.00',
      payMode: 'free',
      status: STATUS_PENDING,
      expireAt: null,
      createdBy: input.operatorId,
      updatedBy: input.operatorId,
      isDeleted: 0
    })

    const plan = await computeLevelEffect({
      userId: input.userId,
      levelId: input.level.id,
      durationDays: input.durationDays,
      isLongTerm: input.isLongTerm,
      now
    })
    const affected = await repo.markPaid({
      id: orderId,
      paidAt: now,
      effectiveAt: now,
      startAt: plan.startAt,
      endAt: plan.endAt,
      operatorId: input.operatorId
    })

    if (affected === 0) {
      throw new LevelOrderSettledError()
    }

    await writeLevelEffect({
      userId: input.userId,
      levelId: input.level.id,
      plan,
      now,
      operatorId: input.operatorId
    })

    const row = await repo.findById(orderId)

    if (!row) {
      throw new AppError('module.system.memberLevelOrder.notFound')
    }

    log.info('memberLevelOrder created', {
      memberLevelOrder: { action: 'createFreeTx', id: orderId, userId: input.userId, levelId: input.level.id }
    })

    return toCreateResult(row)
  }

  /** 余额支付：同一事务内「落单 → 冻结 → 确认扣款 → 单据 OD → 等级生效」 */
  async function createBalanceTx(input: {
    userId: string
    level: LevelRow
    requestId: string
    payAmount: string
    freezeBizNo: string
    isLongTerm: boolean
    durationDays: number
    operatorId: string | null
  }): Promise<CreateLevelOrderResult> {
    const orderId = randomUuid()
    const outTradeNo = buildOutTradeNo('MLV')
    const now = nowForMysql()

    await repo.insert({
      id: orderId,
      outTradeNo,
      requestId: input.requestId,
      userId: input.userId,
      levelId: input.level.id,
      levelName: input.level.name,
      durationDays: input.durationDays,
      priceAmount: input.level.price,
      payAmount: input.payAmount,
      payMode: 'balance',
      status: STATUS_PENDING,
      // 余额支付是同步扣款，没有「支付超时」语义
      expireAt: null,
      createdBy: input.operatorId,
      updatedBy: input.operatorId,
      isDeleted: 0
    })

    /**
     * 余额不足时 `freeze` 抛 `module.system.member.balanceInsufficient`，整事务回滚：
     * 不落单、不冻结、不扣款（与订单余额单一致）。
     * `ttlMinutes = 0`：冻结不设过期，释放权只归本链路（这里立即确认）。
     */
    const frozen = await wallet.freeze({
      userId: input.userId,
      bizNo: input.freezeBizNo,
      amount: input.payAmount,
      subject: `会员等级 ${input.level.name}`,
      // 反向指针：重复提交时按冻结单 attach 找回原单
      attach: orderId,
      ttlMinutes: 0,
      operatorId: input.operatorId
    })

    await repo.attachFreeze({
      id: orderId,
      freezeId: frozen.freezeId,
      operatorId: input.operatorId
    })

    // 确认实扣：写 level_open 流水（与商城消费 consume_confirm 区分）、扣赠送金批次、累计 total_consume
    await wallet.confirm({
      freezeId: frozen.freezeId,
      bizType: 'level_open',
      operatorId: input.operatorId
    })

    const plan = await computeLevelEffect({
      userId: input.userId,
      levelId: input.level.id,
      durationDays: input.durationDays,
      isLongTerm: input.isLongTerm,
      now
    })
    const affected = await repo.markPaid({
      id: orderId,
      paidAt: now,
      effectiveAt: now,
      startAt: plan.startAt,
      endAt: plan.endAt,
      operatorId: input.operatorId
    })

    if (affected === 0) {
      throw new LevelOrderSettledError()
    }

    await writeLevelEffect({
      userId: input.userId,
      levelId: input.level.id,
      plan,
      now,
      operatorId: input.operatorId
    })

    const row = await repo.findById(orderId)

    if (!row) {
      throw new AppError('module.system.memberLevelOrder.notFound')
    }

    log.info('memberLevelOrder created', {
      memberLevelOrder: {
        action: 'createBalanceTx',
        id: orderId,
        userId: input.userId,
        levelId: input.level.id,
        amount: input.payAmount
      }
    })

    return toCreateResult(row)
  }

  /** 在线支付：先落一张 `WP` 单（渠道下单在事务外做） */
  async function insertOnlinePendingTx(input: {
    userId: string
    level: LevelRow
    requestId: string
    payAmount: string
    durationDays: number
    operatorId: string | null
  }): Promise<{ orderId: string, outTradeNo: string, expireAt: string }> {
    const orderId = randomUuid()
    const outTradeNo = buildOutTradeNo('MLV')
    // 与渠道支付单的过期时间同口径，回填失败时用它兜底
    const expireAt = nowForMysql(addMinutes(new Date(), LEVEL_ORDER_TTL_MINUTES))

    await repo.insert({
      id: orderId,
      outTradeNo,
      requestId: input.requestId,
      userId: input.userId,
      levelId: input.level.id,
      levelName: input.level.name,
      durationDays: input.durationDays,
      priceAmount: input.level.price,
      payAmount: input.payAmount,
      payMode: 'online',
      status: STATUS_PENDING,
      expireAt,
      createdBy: input.operatorId,
      updatedBy: input.operatorId,
      isDeleted: 0
    })

    log.info('memberLevelOrder created', {
      memberLevelOrder: {
        action: 'insertOnlinePendingTx',
        id: orderId,
        userId: input.userId,
        levelId: input.level.id,
        amount: input.payAmount
      }
    })

    return { orderId, outTradeNo, expireAt }
  }

  /** 回填支付单（事务内；回填失败不能置 FL，支付单已经落到渠道侧了） */
  async function attachPayOrderTx(input: {
    orderId: string
    payOrderId: string
    payChannelCode: string | null
    expireAt: string | null
    operatorId: string | null
  }) {
    const affected = await repo.attachPayOrder({
      id: input.orderId,
      payOrderId: input.payOrderId,
      payChannelCode: input.payChannelCode,
      expireAt: input.expireAt,
      operatorId: input.operatorId
    })

    log.info('memberLevelOrder pay order attached', {
      memberLevelOrder: { action: 'attachPayOrderTx', id: input.orderId }
    })

    return affected
  }

  /** 渠道下单失败：单据置 FL（不动余额），失败原因写 fail_reason */
  async function failOnlineTx(input: { orderId: string, message: string, operatorId: string | null }) {
    await repo.markFailed({
      id: input.orderId,
      reason: truncateText(input.message, 500),
      operatorId: input.operatorId
    })

    log.info('memberLevelOrder marked failed', {
      memberLevelOrder: { action: 'failOnlineTx', id: input.orderId, status: 'FL' }
    })
  }

  /** 关闭未生效单据（仅 WP 可关；CL 幂等返回）；冻结仍处冻结态时一并释放 */
  async function closeTx(input: {
    outTradeNo: string
    reason: string | null
    operatorId: string | null
  }): Promise<{ closed: boolean, reused: boolean }> {
    const row = await repo.findByOutTradeNo(input.outTradeNo)

    if (!row) {
      throw new AppError('module.system.memberLevelOrder.notFound')
    }

    if (row.status === STATUS_CLOSED) {
      return { closed: false, reused: true }
    }

    if (row.status !== STATUS_PENDING) {
      throw new AppError('module.system.memberLevelOrder.notClosable')
    }

    /**
     * 释放冻结（幂等）：余额路径是「冻结后立即确认」，正常不会留下 FROZEN 的冻结单，
     * 因此这里先查状态、只在确实还冻结时释放，避免对已确认/已释放的单子报
     * `freezeNotFrozen`。释放不改余额（预扣本来就没扣钱）。
     */
    if (row.freezeId) {
      const freeze = await wallet.findFreezeById(row.freezeId)

      if (freeze?.status === 'FROZEN') {
        await wallet.release({
          freezeId: row.freezeId,
          reason: input.reason ?? '开通单关闭',
          operatorId: input.operatorId
        })
      }
    }

    const affected = await repo.markClosed({
      id: row.id,
      reason: truncateText(input.reason, 500),
      operatorId: input.operatorId
    })

    if (affected === 0) {
      return { closed: false, reused: true }
    }

    log.info('memberLevelOrder closed', {
      memberLevelOrder: { action: 'closeTx', id: row.id, status: 'CL' }
    })

    return { closed: true, reused: false }
  }

  /**
   * 支付成功生效（回调 / 主动同步 / 免费单共用）。
   *
   * - `OD` → 幂等返回 `reused = true`；
   * - `CL` / `FL` → **no-op**（只对 `WP` 生效）：不抛错，避免支付回调因为一张已关闭的单
   *   反复返回 5xx 无限重试；本地关单时已经尽力关闭了渠道支付单，不会再有钱进来；
   * - `WP` → 条件更新 `WP → OD`（抢输即抛 `LevelOrderSettledError`）+ 同事务写回等级。
   */
  async function markPaidTx(input: {
    outTradeNo: string
    operatorId: string | null
  }): Promise<MarkLevelPaidResult> {
    const row = await repo.findByOutTradeNo(input.outTradeNo)

    if (!row) {
      throw new AppError('module.system.memberLevelOrder.notFound')
    }

    if (row.status === STATUS_ACTIVE) {
      return toMarkPaidResult(row, true)
    }

    if (row.status !== STATUS_PENDING) {
      return toMarkPaidResult(row, true)
    }

    /**
     * 等级可能已被停用/删除，但「用户已经付过钱」是既定事实，仍按单据快照生效：
     * 时长取单据快照，长期判定看「快照时长为 0」或等级当前配置。
     */
    const level = await levels.findById(row.levelId)
    const isLongTerm = Number(level?.isLongTerm ?? 0) === 1 || Number(row.durationDays) <= 0
    const now = nowForMysql()
    const plan = await computeLevelEffect({
      userId: row.userId,
      levelId: row.levelId,
      durationDays: Math.max(0, Number(row.durationDays) || 0),
      isLongTerm,
      now
    })

    const affected = await repo.markPaid({
      id: row.id,
      paidAt: row.paidAt ?? now,
      effectiveAt: now,
      startAt: plan.startAt,
      endAt: plan.endAt,
      operatorId: input.operatorId
    })

    if (affected === 0) {
      throw new LevelOrderSettledError()
    }

    await writeLevelEffect({
      userId: row.userId,
      levelId: row.levelId,
      plan,
      now,
      operatorId: input.operatorId
    })

    const latest = await repo.findById(row.id)

    log.info('memberLevelOrder marked paid', {
      memberLevelOrder: { action: 'markPaidTx', id: row.id, userId: row.userId, levelId: row.levelId, status: 'OD' }
    })

    return toMarkPaidResult(latest ?? row, false)
  }

  return {
    getByOutTradeNo: async (outTradeNo: string) => await repo.findByOutTradeNo(outTradeNo),
    getByOrderId: async (orderId: string) => await repo.findById(orderId),
    /** 按提交幂等键回读（不过滤软删，见 levelOrderRepo.findByRequestId） */
    getByRequestId: async (requestId: string) => await repo.findByRequestId(requestId),
    listByUser: async (userId: string, limit = 100) => await repo.listByUser(userId, limit),
    /** 该用户是否已有过该等级的免费成功单据（0 元等级禁止重复开通的判据） */
    existsFreePaidOrder: async (userId: string, levelId: string) =>
      await repo.existsFreePaidOrder(userId, levelId),
    /** 该用户有过免费成功单据的等级 id（`myLevelOptions` 批量判定用，避免 N 次查询） */
    listFreePaidLevelIds: async (userId: string) => await repo.listFreePaidLevelIds(userId),
    /** 未超时的同参数待支付单据（在线支付重复提交复用） */
    findPendingOnline: async (userId: string, levelId: string) =>
      await repo.findPending({ userId, levelId, payMode: 'online' }),
    getLevelOrThrow,
    assertLevelOpenAllowed,
    createFreeTx,
    createBalanceTx,
    insertOnlinePendingTx,
    attachPayOrderTx,
    failOnlineTx,
    closeTx,
    markPaidTx,
    /**
     * 后台手工调整的留痕单：**只挂事务内版本**（不挂 `memberLevelOrderService(db)`），
     * 强制调用方把它放进「改会员档案」的同一事务里，避免留痕与档案分叉。
     */
    recordManualTx,
    toCreateResult,
    toStatusResult
  }
}

/**
 * 绑定到已有事务的开通单域服务（调用方保证事务边界）。
 *
 * 与 `walletServiceIn` / `memberServiceIn` 同形：`buildMemberLevelOrder(executor)` 本来就是
 * executor 绑定版，这里再导出同义入口，让「在别人的事务里用」这件事在调用点一眼可见
 * （当前唯一使用者是 `MemberService.changeLevel` / `onboard` 的手工调整留痕）。
 */
export function memberLevelOrderServiceIn(executor: AppExecutor) {
  return buildMemberLevelOrder(executor)
}

/**
 * 独立使用的开通域服务：负责事务边界与网络调用编排。
 *
 * - `create`：按等级价与所选支付方式分派三条通道；
 * - `markPaid`：回调 / 同步共用的生效入口，自带事务且幂等；
 * - `close`：关闭未生效单据（本地），渠道支付单由调用方尽力关闭；
 * - `sync`：先在事务外查渠道，再按与回调相同的幂等路径推进（照 `myRechargeSync` 的三段结构）。
 */
export function memberLevelOrderService(db: AppDb) {
  const reads = buildMemberLevelOrder(db)
  const run = async <T>(fn: (tx: AppTx) => Promise<T>): Promise<T> => await db.transaction(async tx => await fn(tx))

  /** 支付成功生效：回调 / 主动同步 / 免费单共用（局部函数，避免在对象字面量里用 this） */
  async function markPaid(outTradeNo: string, operatorId: string | null = null): Promise<MarkLevelPaidResult> {
    try {
      return await run(tx => buildMemberLevelOrder(tx).markPaidTx({ outTradeNo, operatorId }))
    } catch (error) {
      if (isLevelOrderSettled(error)) {
        const row = await reads.getByOutTradeNo(outTradeNo)

        if (row) {
          return toMarkPaidResult(row, true)
        }
      }

      throw error
    }
  }

  /** 关闭未生效单据：本地关单在事务内完成，渠道关单失败不影响本地结果 */
  async function close(input: {
    outTradeNo: string
    reason?: string | null
    operatorId?: string | null
  }): Promise<{ closed: boolean, reused: boolean }> {
    const operatorId = input.operatorId ?? null
    const before = await reads.getByOutTradeNo(input.outTradeNo)

    const result = await run(tx => buildMemberLevelOrder(tx).closeTx({
      outTradeNo: input.outTradeNo,
      reason: input.reason ?? null,
      operatorId
    }))

    // 本地确实关掉了才去关渠道支付单：尽力而为，失败不影响本地状态
    if (result.closed && before?.payOrderId) {
      try {
        await payOrderService(db).closePayment(before.payOrderId, { operatorId })
      } catch {
        // 支付单可能已支付/已关闭：忽略
      }
    }

    return result
  }

  /** 本地支付单快照（不查渠道）：重复提交复用原单时用来补二维码信息 */
  async function readPayOrderSnapshot(payOrderId: string | null) {
    if (!payOrderId) {
      return null
    }

    try {
      return await payOrderService(db).getById(payOrderId)
    } catch {
      return null
    }
  }

  /**
   * 复用已有单据的结果。
   *
   * - `OD` / `CL` / `FL`：直接返回单据快照（免费单与余额单本来就落 `OD`）；
   * - `WP`（在线待支付）：补一次**本地**支付单快照把二维码三件套带回去；
   *   若本地支付单已是 `OD`（回调到了但业务后置没做完），先按同一 `markPaid` 自愈生效。
   */
  async function toReusedResult(row: LevelOrderRow): Promise<CreateLevelOrderResult> {
    if (row.status !== STATUS_PENDING) {
      return reads.toCreateResult(row, { reused: true })
    }

    const payOrder = await readPayOrderSnapshot(row.payOrderId)

    if (payOrder?.status === 'OD') {
      await markPaid(row.outTradeNo, null)

      const latest = await reads.getByOutTradeNo(row.outTradeNo)

      if (latest) {
        return reads.toCreateResult(latest, { reused: true })
      }
    }

    return reads.toCreateResult(row, {
      qrImageUrl: payOrder?.qrImageUrl ?? null,
      qrContent: payOrder?.qrContent ?? null,
      payUrl: payOrder?.payUrl ?? null,
      reused: true
    })
  }

  /**
   * 落单并发冲突的幂等回落：`request_id` 唯一键冲突（或余额路径的冻结业务号冲突）说明
   * 同一提交已经落过单，回读原单按幂等返回，而不是把内部错误抛给用户。
   * 命中同一 requestId 但属于别的用户时按非法提交处理（不泄漏他人单据）。
   */
  async function recoverByRequestId(
    error: unknown,
    input: { requestId: string, userId: string }
  ): Promise<CreateLevelOrderResult | null> {
    const duplicated = isDuplicateKeyError(error)
      || (error instanceof Error && error.name === 'AlreadyAppliedError')

    if (!duplicated) {
      return null
    }

    const row = await reads.getByRequestId(input.requestId)

    if (!row) {
      return null
    }

    if (row.userId !== input.userId) {
      throw new AppError('module.system.memberLevelOrder.requestIdConflict')
    }

    return await toReusedResult(row)
  }

  /**
   * 在线支付的第二道兜底：同用户 + 同等级 + `online` 且**未超时**的 `WP` 单据直接复用。
   *
   * 主幂等键是 `request_id`（前端每次提交生成）；这一层只覆盖「前端每次点击都换了一个新
   * requestId」的场景，避免连点生成两张都能支付的二维码导致重复付款。
   * 已超时的旧单先本地关闭（并尽力关渠道支付单）再落新单。
   */
  async function reusePendingOnline(input: {
    userId: string
    levelId: string
    operatorId: string | null
  }): Promise<CreateLevelOrderResult | null> {
    const pending = await reads.findPendingOnline(input.userId, input.levelId)

    if (!pending) {
      return null
    }

    const now = nowForMysql()

    if (!pending.expireAt || pending.expireAt > now) {
      return await toReusedResult(pending)
    }

    // 超时未支付：本地关单 + 尽力关渠道支付单，然后另开新单
    await close({ outTradeNo: pending.outTradeNo, reason: '支付超时未支付', operatorId: input.operatorId })

    return null
  }

  /** 渠道可用性预检：与 RechargeService.create 同口径（未配置 / 未通过测试配置都提前报错） */
  async function assertChannelReady(): Promise<PayChannelRow> {
    const channel = await payChannelRepo(db).findEnabled({})

    if (!channel) {
      throw new AppError('module.system.payChannel.notConfigured')
    }

    if (channel.verifyStatus !== 1) {
      throw new AppError('module.system.payChannel.notVerified', { message: channel.configName })
    }

    return channel
  }

  return {
    getByOutTradeNo: reads.getByOutTradeNo,
    listByUser: reads.listByUser,
    /** 免费等级重复开通的判据（`myLevelOptions` 与应用层硬校验共用） */
    existsFreePaidOrder: reads.existsFreePaidOrder,
    listFreePaidLevelIds: reads.listFreePaidLevelIds,
    markPaid,
    close,

    /**
     * 发起开通（购买 / 续费）。
     *
     * 幂等优先级：
     * 1. **同一 requestId 已落单** → 直接返回该单快照（`reused: true`）：余额 / 免费单是 `OD`，
     *    在线单带回原二维码与 `WP`；落单撞唯一键时同样回读原单，不抛内部错误；
     * 2. 在线支付额外一层「同用户 + 同等级未超时的 WP 单复用」（见 `reusePendingOnline`）；
     * 3. 都没有 → 先做**开通硬校验**（`assertLevelOpenAllowed`：0 元等级禁止重复开通 / 续费、
     *    长期等级已激活禁止续费），再按等级价与支付方式走免费 / 余额 / 在线三条通道。
     */
    async create(input: CreateLevelOrderInput): Promise<CreateLevelOrderResult> {
      const operatorId = input.operatorId ?? null

      // 幂等第一道：同一提交（requestId）已落过单就直接复用，连等级是否还启用都不必校验
      const existing = await reads.getByRequestId(input.requestId)

      if (existing) {
        if (existing.userId !== input.userId) {
          throw new AppError('module.system.memberLevelOrder.requestIdConflict')
        }

        return await toReusedResult(existing)
      }

      const level = await reads.getLevelOrThrow(input.levelId)
      const isLongTerm = Number(level.isLongTerm) === 1 || Number(level.durationDays) <= 0
      const durationDays = isLongTerm ? 0 : Math.max(1, Math.floor(Number(level.durationDays) || 0))
      const priceAmount = String(level.price ?? '0.00')
      const isFree = toCents(priceAmount) === 0

      /**
       * 落单前的权威硬校验（规则与 `myLevelOptions` 的 `canOpen` 同源）：
       * 0 元等级禁止重复开通 / 续费、长期等级已激活禁止续费。
       *
       * 位置在「同一 requestId 幂等回读」之后：重复提交同一张已落单的请求仍然按幂等返回，
       * 不会因为规则变更把用户已提交的单据判成失败。
       */
      await reads.assertLevelOpenAllowed({
        userId: input.userId,
        level,
        isLongTerm
      })

      // 免费等级：用户选的支付方式无意义，服务端固定 free
      if (isFree) {
        try {
          return await run(tx => buildMemberLevelOrder(tx).createFreeTx({
            userId: input.userId,
            level,
            requestId: input.requestId,
            durationDays,
            isLongTerm,
            operatorId
          }))
        } catch (error) {
          const reused = await recoverByRequestId(error, input)

          if (reused) {
            return reused
          }

          throw error
        }
      }

      const payAmount = priceAmount
      const freezeBizNo = `${FREEZE_BIZ_PREFIX}${input.requestId}`

      if (input.payMode === 'balance') {
        try {
          return await run(tx => buildMemberLevelOrder(tx).createBalanceTx({
            userId: input.userId,
            level,
            requestId: input.requestId,
            payAmount,
            freezeBizNo,
            isLongTerm,
            durationDays,
            operatorId
          }))
        } catch (error) {
          // 单据 request_id 唯一键或冻结业务号撞车：同一提交已生效，回读原单按幂等返回
          const reused = await recoverByRequestId(error, input)

          if (reused) {
            return reused
          }

          throw error
        }
      }

      // ── 在线支付 ────────────────────────────────────────────────────────────
      const reused = await reusePendingOnline({
        userId: input.userId,
        levelId: level.id,
        operatorId
      })

      if (reused) {
        return reused
      }

      // 渠道预检放在落单之前：避免留下「已落单但没有支付单」的悬挂单据
      await assertChannelReady()

      let pending: { orderId: string, outTradeNo: string, expireAt: string }

      try {
        pending = await run(tx => buildMemberLevelOrder(tx).insertOnlinePendingTx({
          userId: input.userId,
          level,
          requestId: input.requestId,
          payAmount,
          durationDays,
          operatorId
        }))
      } catch (error) {
        const reusedRow = await recoverByRequestId(error, input)

        if (reusedRow) {
          return reusedRow
        }

        throw error
      }

      try {
        const payments = payOrderService(db)
        const payOrder = await payments.createPayment({
          outTradeNo: pending.outTradeNo,
          amount: payAmount,
          subject: `会员等级 ${level.name}`,
          bizType: PAY_BIZ_TYPE_MEMBER_LEVEL,
          attach: `memberLevel:${pending.orderId}`,
          notifyUrl: input.notifyUrl ?? null,
          origin: input.origin ?? null
        }, { operatorId })

        /**
         * 回填失败**不能**走 FL 分支：支付单已经落到渠道侧，
         * 置 FL 会造成「渠道能收到钱、本地单据却失败」的孤岛。
         * 保持 WP 即可：回调按 out_trade_no 认单照样生效，主动同步也能推进。
         */
        try {
          await run(tx => buildMemberLevelOrder(tx).attachPayOrderTx({
            orderId: pending.orderId,
            payOrderId: payOrder.id,
            payChannelCode: payOrder.channelCode,
            expireAt: payOrder.expireAt ?? pending.expireAt,
            operatorId
          }))
        } catch {
          // 静默：上面的注释说明了为什么可以吞掉
        }

        const latest = await reads.getByOrderId(pending.orderId)

        return latest
          ? reads.toCreateResult(latest, {
              qrImageUrl: payOrder.qrImageUrl ?? null,
              qrContent: payOrder.qrContent ?? null,
              payUrl: payOrder.payUrl ?? null
            })
          : {
              orderId: pending.orderId,
              outTradeNo: pending.outTradeNo,
              status: STATUS_PENDING,
              levelId: level.id,
              levelName: level.name,
              payMode: 'online',
              priceAmount,
              payAmount,
              expireAt: payOrder.expireAt ?? pending.expireAt,
              effectiveAt: null,
              endAt: null,
              qrImageUrl: payOrder.qrImageUrl ?? null,
              qrContent: payOrder.qrContent ?? null,
              payUrl: payOrder.payUrl ?? null,
              reused: false
            }
      } catch (error) {
        const message = toErrorMessage(error, '发起支付失败')

        await run(tx => buildMemberLevelOrder(tx).failOnlineTx({
          orderId: pending.orderId,
          message,
          operatorId
        }))

        throw new AppError('module.system.memberLevelOrder.createFailed', { message, cause: error })
      }
    },

    /**
     * 主动同步开通单状态：先看本地，未终结才向渠道查询。
     *
     * 与 `myRechargeSync` 同构的三段结构：
     * 1. 本地已非 `WP` → 直接返回本地状态（已生效/已关闭/失败都不再问渠道）；
     * 2. 渠道 `OD` → 走同一 `markPaid` 生效；
     * 3. 渠道 `CL` / `FL` → 把本地单据置 `CL` 并写失败原因，返回本地状态。
     */
    async sync(input: {
      outTradeNo: string
      operatorId?: string | null
    }): Promise<LevelOrderStatusResult> {
      const operatorId = input.operatorId ?? null
      const row = await reads.getByOutTradeNo(input.outTradeNo)

      if (!row) {
        throw new AppError('module.system.memberLevelOrder.notFound')
      }

      if (row.status !== STATUS_PENDING) {
        return reads.toStatusResult(row)
      }

      if (!row.payOrderId) {
        return reads.toStatusResult(row)
      }

      const payOrder = await payOrderService(db).queryPayment(row.payOrderId, { operatorId })

      if (payOrder.status === 'OD') {
        await markPaid(row.outTradeNo, operatorId)

        const latest = await reads.getByOutTradeNo(row.outTradeNo)

        return latest ? reads.toStatusResult(latest) : reads.toStatusResult(row)
      }

      if (payOrder.status === 'CL' || payOrder.status === 'FL') {
        await close({
          outTradeNo: row.outTradeNo,
          reason: `支付单已${payOrder.status === 'CL' ? '关闭' : '失败'}`,
          operatorId
        })

        const latest = await reads.getByOutTradeNo(row.outTradeNo)

        return latest ? reads.toStatusResult(latest) : reads.toStatusResult(row)
      }

      // 渠道仍未支付：状态仍按本地单据（WP）返回，页面继续轮询
      return reads.toStatusResult(row)
    }
  }
}

export type MemberLevelOrderService = ReturnType<typeof memberLevelOrderService>
