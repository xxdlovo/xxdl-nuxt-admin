/**
 * 会员领域服务：建档、邀请关系、等级、优惠码。
 *
 * 与余额领域的分工：
 * - 本文件只管「会员身份与营销规则」；
 * - 一切资金变动（注册赠金、充值到账）都调用 `wallet` 领域，本文件不直接改余额。
 *
 * 事务：`memberService(db)` 的写方法自带事务；已在事务中的调用方用 `memberServiceIn(tx)`。
 */
import { AppError } from '#server/utils/appError'
import { isDuplicateKeyError } from '#server/utils/dbError'
import { memberLevelCacheService } from '#server/sys-router/storage/cache/MemberLevelCacheService'
import { type AppDb, type AppExecutor, type AppTx } from '#server/drizzle/db'
import { randomUuid } from '#shared/utils/uuid'
import { nowForMysql } from '../pay/utils'
import { walletServiceIn } from '../wallet/WalletService'
import {
  compareMoney,
  fromCents,
  toCents
} from '../wallet/utils'
import type { CouponResolveResult, CouponScene } from '../wallet/types'
import { couponRepo, type CouponRow } from './repo/couponRepo'
import { couponUseRepo } from './repo/couponUseRepo'
import { inviteCodeRepo } from './repo/inviteCodeRepo'
import { levelRepo, type LevelRow } from './repo/levelRepo'
import { memberRepo, type MemberRow } from './repo/memberRepo'
import type {
  CouponUseInput,
  ExpireLevelsResult,
  MemberLevelSource,
  MemberOnboardResult,
  MemberOnboardSource
} from './types'

/** 注册赠金配置键（在「系统参数」里维护；未配置或为 0 表示不赠送） */
export const REGISTER_BONUS_AMOUNT_KEY = 'member_register_bonus_amount'
export const REGISTER_BONUS_EXPIRE_DAYS_KEY = 'member_register_bonus_expire_days'

/** 等级到期降级任务的单轮扫描上限（与 order:expire-close 同口径） */
export const MEMBER_EXPIRE_LEVEL_BATCH_SIZE = 200

/** 天 → 毫秒（等级时长期限按自然日顺延） */
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

/**
 * 布尔标记归一：Schema 用 `z.union([z.number(), z.boolean()])` 兼容 1/0 与 true/false。
 * 只有明确为 true / 1 才算「是」，其余（false / 0 / null / undefined）都算「否」。
 */
function toBooleanFlag(value: boolean | number | null | undefined): boolean {
  return value === true || Number(value) === 1
}

/** 邀请码字符集：去掉容易混淆的 0/O/1/I */
const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const INVITE_CODE_LENGTH = 8

function randomInviteCode() {
  let code = ''
  for (let index = 0; index < INVITE_CODE_LENGTH; index += 1) {
    code += INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)]
  }

  return code
}

function isActiveStatus(status: number | null | undefined) {
  return status === 1 || status === null || status === undefined
}

function buildMember(executor: AppExecutor) {
  const members = memberRepo(executor)
  const levels = levelRepo(executor)
  const inviteCodes = inviteCodeRepo(executor)
  const coupons = couponRepo(executor)
  const couponUses = couponUseRepo(executor)
  const wallet = walletServiceIn(executor)

  /** 生成一个未被占用的邀请码（唯一索引仍是最终保证） */
  async function generateInviteCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = randomInviteCode()
      if (!(await members.existsInviteCode(candidate))) {
        return candidate
      }
    }

    throw new AppError('module.system.member.inviteCodeGenerateFailed')
  }

  /** 读取会员配置项（注册赠金等） */
  async function readConfigValue(key: string) {
    return await members.readConfigValue(key)
  }

  /** 按邀请码找上级：先找系统通用码，再找会员专属码 */
  async function resolveInviter(inviteCode: string) {
    const codeRow = await inviteCodes.findUsableByCode(inviteCode)

    if (codeRow?.ownerUserId) {
      const owner = await members.findByUserId(codeRow.ownerUserId)

      return { inviterUserId: owner?.userId ?? null, inviteCodeId: codeRow.id }
    }

    if (codeRow) {
      // 系统通用码：本身没有 owner，无法定位上级
      return { inviterUserId: null, inviteCodeId: codeRow.id }
    }

    const memberByCode = await members.findByInviteCode(inviteCode)

    return {
      inviterUserId: memberByCode?.userId ?? null,
      inviteCodeId: memberByCode?.inviteCodeId ?? null
    }
  }

  /**
   * 注册建档（密码注册与第三方首登共用）。
   *
   * 幂等：同一 userId 重复调用只返回既有档案，不重复发注册赠金
   * （赠金本身也有 `register_bonus:{userId}` 幂等键兜底）。
   *
   * 等级归属（规则 2 / 9）：
   * - 显式传了 `levelId`（后台手工建档选等级）→ 用它，`levelSource = 'manual'`；
   *   此时 `expireAt` 按传入值落库（不传 / null = 永不过期，与 SysMemberAddSchema 的注释一致）；
   * - 没传 → 自动分配**全局默认等级**（`is_default = 1`），`expireAt = NULL`（永久不过期）、
   *   `levelSource = 'default'`、`levelStartAt = now`；
   * - 没有配置默认等级 → 维持原状（`levelId = NULL`）。
   *
   * 长期等级（`is_long_term = 1` 或 `duration_days = 0`）恒不过期，传入的 expireAt 会被忽略。
   */
  async function onboard(input: {
    userId: string
    inviteCode?: string | null
    source: MemberOnboardSource
    operatorId?: string | null
    /** 显式指定等级（后台建档用）；不传则分配默认等级 */
    levelId?: string | null
    /** 显式到期时间 `YYYY-MM-DD HH:mm:ss`；null / 不传 = 永不过期 */
    expireAt?: string | null
  }): Promise<MemberOnboardResult> {
    const operatorId = input.operatorId ?? null
    const existing = await members.findByUserId(input.userId)

    if (existing) {
      return {
        memberId: existing.id,
        userId: existing.userId,
        inviteCode: existing.inviteCode,
        created: false,
        inviterId: existing.inviterId ?? null,
        bonusAmount: '0.00'
      }
    }

    const inviteCode = await generateInviteCode()
    const memberId = randomUuid()
    const assignment = await resolveInitialLevel({
      levelId: input.levelId ?? null,
      expireAt: input.expireAt
    })

    try {
      await members.insert({
        id: memberId,
        userId: input.userId,
        inviteCode,
        levelId: assignment.levelId,
        expireAt: assignment.expireAt,
        levelStartAt: assignment.levelStartAt,
        levelSource: assignment.levelSource,
        status: 1,
        remark: input.source === 'oauth' ? '第三方首次登录建档' : '注册建档',
        createdBy: operatorId,
        updatedBy: operatorId,
        isDeleted: 0
      })
    } catch (error) {
      // 并发建档：唯一键冲突说明已经建好，按幂等处理
      if (!isDuplicateKeyError(error)) {
        throw error
      }

      const concurrent = await members.findByUserId(input.userId)

      /**
       * 冲突必须确实是「同 userId 并发建档」才按幂等返回：
       * 邀请码唯一键（uk_member_invite_code）撞车时也满足 isDuplicateKeyError，
       * 但档案并没有建成，静默返回会让调用方以为建档成功（用户永远没有档案）。
       */
      if (!concurrent) {
        throw error
      }

      return {
        memberId: concurrent.id,
        userId: concurrent.userId,
        inviteCode: concurrent.inviteCode,
        created: false,
        inviterId: concurrent.inviterId ?? null,
        bonusAmount: '0.00'
      }
    }

    // 会员专属邀请码：与档案上的 invite_code 保持一致
    await inviteCodes.insert({
      id: randomUuid(),
      code: inviteCode,
      ownerUserId: input.userId,
      source: 'member',
      maxUse: 0,
      usedCount: 0,
      status: 1,
      remark: '会员专属邀请码',
      createdBy: operatorId,
      updatedBy: operatorId,
      isDeleted: 0
    })

    // 绑定上级（单级关系；自己不能用自己的码）
    let inviterId: string | null = null
    const submittedCode = String(input.inviteCode ?? '').trim()

    if (submittedCode && submittedCode !== inviteCode) {
      const resolved = await resolveInviter(submittedCode)

      if (resolved.inviterUserId && resolved.inviterUserId !== input.userId) {
        const bound = await members.bindInviter({
          userId: input.userId,
          inviterId: resolved.inviterUserId,
          inviteCodeId: resolved.inviteCodeId,
          invitedAt: nowForMysql(),
          operatorId
        })

        if (bound > 0) {
          inviterId = resolved.inviterUserId

          if (resolved.inviteCodeId) {
            await inviteCodes.incrementUsedCount(resolved.inviteCodeId, operatorId)
          }
        }
      }
    }

    // 注册赠金：读系统配置，按配置金额与有效期发放（幂等键 register_bonus:{userId}）
    const bonusAmount = await grantRegisterBonus(input.userId, operatorId)

    return {
      memberId,
      userId: input.userId,
      inviteCode,
      created: true,
      inviterId,
      bonusAmount
    }
  }

  /** 发放注册赠金（未配置或金额为 0 时跳过） */
  async function grantRegisterBonus(userId: string, operatorId: string | null): Promise<string> {
    const rawAmount = await readConfigValue(REGISTER_BONUS_AMOUNT_KEY)
    const amountText = String(rawAmount ?? '').trim()

    if (!amountText || !/^\d+(\.\d{1,2})?$/.test(amountText) || Number(amountText) <= 0) {
      return '0.00'
    }

    const rawDays = await readConfigValue(REGISTER_BONUS_EXPIRE_DAYS_KEY)
    const days = Number(String(rawDays ?? '').trim())
    const expireAt = Number.isFinite(days) && days > 0
      ? nowForMysql(new Date(Date.now() + days * 24 * 60 * 60 * 1000))
      : null

    const result = await wallet.credit({
      userId,
      account: 'gift',
      amount: amountText,
      bizType: 'register_bonus',
      bizNo: `register_bonus:${userId}`,
      giftSource: 'register',
      giftExpireAt: expireAt,
      reason: '注册赠金',
      operatorId
    })

    return result.reused ? '0.00' : result.amount
  }

  /** 手工绑定上级（补绑场景） */
  async function bindInviter(input: {
    userId: string
    inviteCode: string
    operatorId?: string | null
  }) {
    const operatorId = input.operatorId ?? null
    const member = await members.findByUserId(input.userId)

    if (!member) {
      throw new AppError('module.system.member.notFound')
    }

    if (member.inviterId) {
      throw new AppError('module.system.member.inviterAlreadyBound')
    }

    const resolved = await resolveInviter(input.inviteCode.trim())

    if (!resolved.inviterUserId) {
      throw new AppError('module.system.member.inviteCodeInvalid')
    }

    if (resolved.inviterUserId === input.userId) {
      throw new AppError('module.system.member.inviterCannotBeSelf')
    }

    const bound = await members.bindInviter({
      userId: input.userId,
      inviterId: resolved.inviterUserId,
      inviteCodeId: resolved.inviteCodeId,
      invitedAt: nowForMysql(),
      operatorId
    })

    if (bound === 0) {
      throw new AppError('module.system.member.inviterAlreadyBound')
    }

    if (resolved.inviteCodeId) {
      await inviteCodes.incrementUsedCount(resolved.inviteCodeId, operatorId)
    }

    return { inviterId: resolved.inviterUserId }
  }

  /**
   * 是否「永不过期」的等级：显式长期等级，或免费（price=0）且不设时长的等级。
   * 规则 1 的硬约束：这类等级下的会员 `expire_at` 恒为 NULL。
   */
  function isLongTermLevel(level: LevelRow): boolean {
    return Number(level.isLongTerm) === 1 || Number(level.durationDays) <= 0
  }

  /**
   * 全局默认等级（`is_default = 1`，且启用中）。
   *
   * 走 `listLevels()`：它内部复用 `MemberLevelCacheService` 的启用列表缓存，
   * 等级写入口（SysMemberLevelService）改 is_default 后会显式失效该缓存，
   * 这里不再单独查库、也不新建第二个缓存 key。
   * 停用/删除的等级不会出现在启用列表里，等价于「没有配置默认等级」。
   */
  async function findDefaultLevel(): Promise<LevelRow | null> {
    const levels = await listLevels()

    return levels.find(item => Number(item.isDefault) === 1) ?? null
  }

  /**
   * 建档时的等级归属：显式传入优先，否则分配默认等级。
   * 显式传入的等级必须是启用中的等级（否则后台建档会静默落到不可用等级上）。
   */
  async function resolveInitialLevel(input: {
    levelId: string | null
    expireAt?: string | null
  }): Promise<{
    levelId: string | null
    expireAt: string | null
    levelStartAt: string | null
    levelSource: MemberLevelSource | null
  }> {
    const now = nowForMysql()

    if (input.levelId) {
      const level = await levels.findById(input.levelId)

      if (!level || !isActiveStatus(level.status)) {
        throw new AppError('module.system.member.levelNotAvailable')
      }

      return {
        levelId: level.id,
        expireAt: isLongTermLevel(level) ? null : (input.expireAt ?? null),
        levelStartAt: now,
        levelSource: 'manual'
      }
    }

    const fallback = await findDefaultLevel()

    if (!fallback) {
      // 没有配置默认等级：维持既有行为（levelId = NULL，后续由后台/任务补）
      return { levelId: null, expireAt: null, levelStartAt: null, levelSource: null }
    }

    return {
      levelId: fallback.id,
      // 默认等级永久不过期
      expireAt: null,
      levelStartAt: now,
      levelSource: 'default'
    }
  }

  /**
   * 手工指定等级与期限（后台运营）。
   *
   * 期限优先级（与 SysMemberChangeLevelSchema 的注释一致）：
   * 1. 目标等级本身是长期等级（或 `longTerm = true`）→ `expire_at = NULL`；
   * 2. 显式传了 `expireAt` → 写该时间（`null` = 清除到期，等同长期）；
   * 3. 两者都没有 → 按目标等级的 `durationDays` 推导（`now + durationDays` 天）。
   *
   * `levelStartAt` 只在等级**确实变化**时重置为 now：只改期限不该把生效时间往后挪。
   * `levelSource` 一律写 `manual`（这是一次人工操作）。
   */
  async function changeLevel(input: {
    userId: string
    levelId: string
    remark?: string | null
    expireAt?: string | null
    longTerm?: boolean | number | null
    operatorId?: string | null
  }) {
    const operatorId = input.operatorId ?? null
    const level = await levels.findById(input.levelId)

    if (!level || !isActiveStatus(level.status)) {
      throw new AppError('module.system.member.levelNotAvailable')
    }

    const member = await members.findByUserId(input.userId)

    if (!member) {
      throw new AppError('module.system.member.notFound')
    }

    const now = nowForMysql()
    const longTerm = toBooleanFlag(input.longTerm) || isLongTermLevel(level)
    let expireAt: string | null

    if (longTerm) {
      expireAt = null
    } else if (input.expireAt !== undefined) {
      expireAt = input.expireAt
    } else {
      expireAt = nowForMysql(addDays(new Date(), Number(level.durationDays)))
    }

    const levelChanged = member.levelId !== input.levelId
    const affected = await members.changeLevel({
      userId: input.userId,
      levelId: input.levelId,
      changedAt: now,
      ...(levelChanged ? { startAt: now } : {}),
      expireAt,
      levelSource: 'manual',
      // 不传 remark = 不动既有备注；传 null = 清空
      ...(input.remark !== undefined ? { remark: input.remark } : {}),
      operatorId
    })

    if (affected === 0) {
      throw new AppError('module.system.member.notFound')
    }

    return true
  }

  /**
   * 单个会员的到期降级（**调用方保证事务边界**，由 `expireLevels` 逐条包事务）。
   *
   * 降到默认等级（没有默认等级则 `levelId = NULL`），并把 `expire_at` 清空成永久、
   * `level_source = 'auto_expire'`、`level_start_at = now`。
   * 返回 false 表示条件更新未命中（并发下已被续费/他人处理），跳过即可。
   */
  async function expireMemberLevel(input: {
    id: string
    now: string
    operatorId?: string | null
  }): Promise<boolean> {
    const fallback = await findDefaultLevel()
    const affected = await members.expireLevel({
      id: input.id,
      now: input.now,
      levelId: fallback?.id ?? null,
      operatorId: input.operatorId ?? null
    })

    return affected > 0
  }

  /** 等级到期降级的扫描候选（`member:expire-level` 任务用） */
  async function listExpiredLevelCandidates(now: string, limit = MEMBER_EXPIRE_LEVEL_BATCH_SIZE) {
    return await members.listExpiredLevelCandidates(now, limit)
  }

  /**
   * 解析并校验优惠码（不核销）。
   *
   * 规则（保持简单，不做叠加）：固定金额直接抵扣，折扣率按「应付比例」计算；
   * 折扣后应付金额必须大于 0，否则视为不可用（避免生成 0 元支付单）。
   */
  async function resolveCoupon(input: {
    code?: string | null
    userId: string
    scene: Exclude<CouponScene, 'all'>
    amount: string | number
    /**
     * 仅校验券本身是否可用、跳过「金额相关」判定（门槛与应付必须 > 0）。
     * 用于「还没填金额就先校验优惠码」的场景：此时金额按 0 处理，
     * 只能确认券存在、在有效期内、场景匹配、未超额，抵扣额等填了金额再算。
     */
    skipAmountCheck?: boolean
  }): Promise<CouponResolveResult | null> {
    const code = String(input.code ?? '').trim()

    if (!code) {
      return null
    }

    const coupon = await coupons.findByCode(code)

    if (!coupon) {
      throw new AppError('module.system.member.couponNotFound')
    }

    // 状态用数值比较：drizzle 对 tinyint().default(1) 会推导出字面量类型，直接写 === 2 会被 TS 判为无重叠
    const couponStatus = Number(coupon.status ?? 0)

    if (couponStatus === 2) {
      throw new AppError('module.system.member.couponVoided')
    }

    if (couponStatus !== 1) {
      throw new AppError('module.system.member.couponDisabled')
    }

    const now = nowForMysql()

    if (coupon.validFrom && coupon.validFrom > now) {
      throw new AppError('module.system.member.couponNotStarted')
    }

    if (coupon.validTo && coupon.validTo <= now) {
      throw new AppError('module.system.member.couponExpired')
    }

    if (coupon.scene !== 'all' && coupon.scene !== input.scene) {
      throw new AppError('module.system.member.couponSceneMismatch')
    }

    if (coupon.maxUse > 0 && coupon.usedCount >= coupon.maxUse) {
      throw new AppError('module.system.member.couponUsedUp')
    }

    const amountCents = toCents(String(input.amount))

    if (!input.skipAmountCheck && compareMoney(fromCents(amountCents), coupon.minAmount) < 0) {
      throw new AppError('module.system.member.couponMinAmount', { message: coupon.minAmount })
    }

    if (coupon.perUserLimit > 0) {
      const [used, locked] = await Promise.all([
        couponUses.countUsedByUser(coupon.id, input.userId),
        couponUses.countLockedByUser(coupon.id, input.userId)
      ])

      if (used + locked >= coupon.perUserLimit) {
        throw new AppError('module.system.member.couponUserLimit')
      }
    }

    const { discountCents, payableCents } = input.skipAmountCheck && amountCents <= 0
      ? { discountCents: 0, payableCents: 0 }
      : computeDiscount(coupon, amountCents)

    if (!input.skipAmountCheck && payableCents <= 0) {
      /**
       * 面值型优惠码的抵扣会吃掉整单金额（应付 ≤ 0）：把「需要达到的金额」作为 message 带出去，
       * 前端据此提示「该券面值 ¥X，订单金额需大于该金额才可使用」，而不是干巴巴一句「无法使用」。
       * 折扣率型券正常不会走到这里（应付比例 > 0），兜底用门槛金额。
       */
      const requireAmount = coupon.type === 'amount'
        ? fromCents(toCents(coupon.value))
        : fromCents(toCents(coupon.minAmount))

      throw new AppError('module.system.member.couponNotApplicable', { message: requireAmount })
    }

    return {
      couponId: coupon.id,
      code: coupon.code,
      type: coupon.type as CouponResolveResult['type'],
      value: fromCents(toCents(coupon.value)),
      minAmount: fromCents(toCents(coupon.minAmount)),
      discountAmount: fromCents(discountCents),
      giftAmount: coupon.giftAmount,
      payableAmount: fromCents(payableCents)
    }
  }

  /** 折扣计算：amount=固定金额封顶；rate=应付比例（0.90 表示九折） */
  function computeDiscount(coupon: CouponRow, amountCents: number) {
    if (coupon.type === 'rate') {
      const rateCents = toCents(coupon.value)
      const discountCents = Math.round((amountCents * (100 - rateCents)) / 100)

      return { discountCents, payableCents: amountCents - discountCents }
    }

    const valueCents = toCents(coupon.value)
    const discountCents = Math.min(valueCents, amountCents)

    return { discountCents, payableCents: amountCents - discountCents }
  }

  /** 锁定优惠码（充值发起时调用）：写使用记录 + 累计核销数，幂等 */
  async function lockCoupon(input: CouponUseInput) {
    const operatorId = null
    const existing = await couponUses.findByBizNo(input.bizNo)

    if (existing) {
      return { locked: true, reused: true }
    }

    try {
      await couponUses.insert({
        id: randomUuid(),
        couponId: input.couponId,
        couponCode: input.couponCode,
        userId: input.userId,
        scene: input.scene,
        bizNo: input.bizNo,
        discountAmount: input.discountAmount,
        giftAmount: input.giftAmount,
        status: 'locked',
        createdBy: operatorId,
        updatedBy: operatorId,
        isDeleted: 0
      })
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        /**
         * 撞 `uk_member_coupon_use(coupon_id, biz_no)` 只说明「该业务单号已有占用记录」，
         * 必须回读确认它确实存在才敢按幂等返回。
         *
         * 不能无条件 `return { locked: true }`：冲突也可能来自主键（极端情况），
         * 或并发已提交的行在当前快照里读不到 —— 那时券其实没锁上，
         * 静默返回成功会让订单/充值带着「已锁券」的假象继续走下去。
         * 查不到就原样抛出（修复前走的就是抛出分支，因此不存在行为倒退）。
         */
        const locked = await couponUses.findByBizNo(input.bizNo)

        if (locked) {
          return { locked: true, reused: true }
        }
      }

      throw error
    }

    const affected = await coupons.incrementUsedCount(input.couponId, operatorId)

    if (affected === 0) {
      throw new AppError('module.system.member.couponUsedUp')
    }

    return { locked: true, reused: false }
  }

  /** 核销优惠码（充值到账） */
  async function markCouponUsed(input: { bizNo: string; operatorId?: string | null }) {
    return await couponUses.markUsed(input.bizNo, nowForMysql(), input.operatorId ?? null)
  }

  /** 释放优惠码（充值关闭 / 消费失败） */
  async function releaseCoupon(input: { bizNo: string; operatorId?: string | null }) {
    return await couponUses.markReleased(input.bizNo, nowForMysql(), input.operatorId ?? null)
  }

  /** 会员档案（自助接口用） */
  async function getMember(userId: string): Promise<MemberRow | null> {
    return await members.findByUserId(userId)
  }

  /** 我邀请的下级 */
  async function listInvitees(userId: string) {
    return await members.listInvitees(userId)
  }

  /** 我邀请的下级数量（只需计数时用，避免把下级列表整表物化出来只为取 length） */
  async function countInvitees(userId: string) {
    return await members.countInvitees(userId)
  }

  /**
   * 等级下拉（商城列表/详情、个人中心、商品等级价弹窗都走这里）。
   * 整表读 + 一处缓存：写入口（SysMemberLevelService）显式失效，TTL 只作兜底。
   */
  async function listLevels() {
    return await memberLevelCacheService().getEnabledList(async () => await levels.listEnabled())
  }

  /** 我的券使用记录 */
  async function listMyCoupons(userId: string) {
    return await couponUses.listByUser(userId)
  }

  /** 还没有会员档案的用户 id（`member:backfill-profile` 任务用） */
  async function listUnprofiledUsers(limit = 200) {
    return await members.listUserIdsWithoutProfile(limit)
  }

  /**
   * 用户下拉搜索（后台选择会员/待建档用户用）。
   * 只返回下拉需要的展示字段，避免把整行用户信息暴露给前端。
   */
  async function searchUserOptions(input: {
    keyword?: string | null
    limit?: number
    scope?: 'member' | 'unprofiled'
  }) {
    return await members.searchUserOptions({
      keyword: input.keyword ?? null,
      limit: Math.min(Math.max(input.limit ?? 20, 1), 50),
      scope: input.scope === 'unprofiled' ? 'unprofiled' : 'member'
    })
  }

  return {
    onboard,
    bindInviter,
    changeLevel,
    resolveCoupon,
    lockCoupon,
    markCouponUsed,
    releaseCoupon,
    getMember,
    listInvitees,
    countInvitees,
    listLevels,
    findDefaultLevel,
    expireMemberLevel,
    listExpiredLevelCandidates,
    listMyCoupons,
    listUnprofiledUsers,
    searchUserOptions,
    readConfigValue,
    grantRegisterBonus
  }
}

/** 绑定到已有事务的会员服务（调用方保证事务边界） */
export function memberServiceIn(executor: AppExecutor) {
  return buildMember(executor)
}

/** 独立使用的会员服务：写方法自带事务 */
export function memberService(db: AppDb) {
  const reads = buildMember(db)
  const run = async <T>(fn: (tx: AppTx) => Promise<T>): Promise<T> => await db.transaction(async tx => await fn(tx))

  return {
    ...reads,
    onboard: async (input: Parameters<typeof reads.onboard>[0]) => await run(tx => buildMember(tx).onboard(input)),
    bindInviter: async (input: Parameters<typeof reads.bindInviter>[0]) => await run(tx => buildMember(tx).bindInviter(input)),
    changeLevel: async (input: Parameters<typeof reads.changeLevel>[0]) => await run(tx => buildMember(tx).changeLevel(input)),
    lockCoupon: async (input: Parameters<typeof reads.lockCoupon>[0]) => await run(tx => buildMember(tx).lockCoupon(input)),
    grantRegisterBonus: async (userId: string, operatorId: string | null) => await run(tx => buildMember(tx).grantRegisterBonus(userId, operatorId)),
    resolveCoupon: reads.resolveCoupon,
    markCouponUsed: reads.markCouponUsed,
    releaseCoupon: reads.releaseCoupon,

    /**
     * 等级到期降级（`member:expire-level` 任务）：
     * 扫到期档案 → **逐条独立事务**降级到默认等级，单条失败不影响其余
     * （与 `OrderService.expireClose` 的形态一致）。
     */
    async expireLevels(limit = MEMBER_EXPIRE_LEVEL_BATCH_SIZE): Promise<ExpireLevelsResult> {
      const now = nowForMysql()
      const rows = await reads.listExpiredLevelCandidates(now, limit)
      const failures: Array<{ userId: string, message: string }> = []
      let changedCount = 0

      for (const row of rows) {
        try {
          const changed = await run(tx => buildMember(tx).expireMemberLevel({
            id: row.id,
            now,
            operatorId: null
          }))

          if (changed) {
            changedCount += 1
          }
        } catch (error) {
          failures.push({
            userId: row.userId,
            message: error instanceof Error ? error.message : 'unknown error'
          })
        }
      }

      return { scanned: rows.length, changedCount, failures }
    }
  }
}

export type MemberService = ReturnType<typeof memberService>
