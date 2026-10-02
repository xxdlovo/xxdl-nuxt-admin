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
import { type AppDb, type AppExecutor, type AppTx } from '#server/drizzle/db'
import { randomUuid } from '#shared/utils/uuid'
import { nowForMysql } from '../pay/utils'
import { walletServiceIn } from '../wallet/WalletService'
import { isDuplicateKeyError } from '../wallet/repo/sqlUtils'
import {
  compareMoney,
  fromCents,
  toCents
} from '../wallet/utils'
import type { CouponResolveResult, CouponScene } from '../wallet/types'
import { couponRepo, type CouponRow } from './repo/couponRepo'
import { couponUseRepo } from './repo/couponUseRepo'
import { inviteCodeRepo } from './repo/inviteCodeRepo'
import { levelRepo } from './repo/levelRepo'
import { memberRepo, type MemberRow } from './repo/memberRepo'
import type { CouponUseInput, MemberOnboardResult, MemberOnboardSource } from './types'

/** 注册赠金配置键（在「系统参数」里维护；未配置或为 0 表示不赠送） */
export const REGISTER_BONUS_AMOUNT_KEY = 'member_register_bonus_amount'
export const REGISTER_BONUS_EXPIRE_DAYS_KEY = 'member_register_bonus_expire_days'

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
   */
  async function onboard(input: {
    userId: string
    inviteCode?: string | null
    source: MemberOnboardSource
    operatorId?: string | null
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

    try {
      await members.insert({
        id: memberId,
        userId: input.userId,
        inviteCode,
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

      return {
        memberId: concurrent?.id ?? memberId,
        userId: input.userId,
        inviteCode: concurrent?.inviteCode ?? inviteCode,
        created: false,
        inviterId: concurrent?.inviterId ?? null,
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

  /** 手工指定等级（等级不自动升降） */
  async function changeLevel(input: {
    userId: string
    levelId: string
    remark?: string | null
    operatorId?: string | null
  }) {
    const operatorId = input.operatorId ?? null
    const level = await levels.findById(input.levelId)

    if (!level || !isActiveStatus(level.status)) {
      throw new AppError('module.system.member.levelNotAvailable')
    }

    const affected = await members.changeLevel({
      userId: input.userId,
      levelId: input.levelId,
      changedAt: nowForMysql(),
      remark: input.remark ?? null,
      operatorId
    })

    if (affected === 0) {
      throw new AppError('module.system.member.notFound')
    }

    return true
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

    if (compareMoney(fromCents(amountCents), coupon.minAmount) < 0) {
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

    const { discountCents, payableCents } = computeDiscount(coupon, amountCents)

    if (payableCents <= 0) {
      throw new AppError('module.system.member.couponNotApplicable')
    }

    return {
      couponId: coupon.id,
      code: coupon.code,
      type: coupon.type as CouponResolveResult['type'],
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
        return { locked: true, reused: true }
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

  /** 等级下拉 */
  async function listLevels() {
    return await levels.listEnabled()
  }

  /** 我的券使用记录 */
  async function listMyCoupons(userId: string) {
    return await couponUses.listByUser(userId)
  }

  /** 还没有会员档案的用户 id（`member:backfill-profile` 任务用） */
  async function listUnprofiledUsers(limit = 200) {
    return await members.listUserIdsWithoutProfile(limit)
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
    listLevels,
    listMyCoupons,
    listUnprofiledUsers,
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
    releaseCoupon: reads.releaseCoupon
  }
}

export type MemberService = ReturnType<typeof memberService>
