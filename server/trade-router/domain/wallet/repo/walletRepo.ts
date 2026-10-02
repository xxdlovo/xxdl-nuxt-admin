/**
 * 会员钱包 mapper（数据访问层）。
 *
 * 设计要点：
 * - 所有余额变更都是**条件更新**（WHERE 带可用余额守卫），靠 `affectedRows` 判断是否生效，
 *   这样即使并发也不会把余额扣成负数；
 * - 需要在事务内「先读后写」时，用 `lockByUserId()` 对钱包行加排他锁（`SELECT ... FOR UPDATE`）；
 * - 金额参数一律传「元 + 两位小数字符串」，由 MySQL 隐式转换为 decimal，避免浮点误差。
 */
import { and, eq, sql } from 'drizzle-orm'
import { sysMemberWallet } from '#server/drizzle/schema'
import { asDb, type AppExecutor } from '#server/drizzle/db'
import { affectedRows } from './sqlUtils'

export type WalletRow = typeof sysMemberWallet.$inferSelect
export type WalletInsert = typeof sysMemberWallet.$inferInsert

export function walletRepo(executor: AppExecutor) {
  const db = asDb(executor)

  return {
    async findByUserId(userId: string): Promise<WalletRow | null> {
      const rows = await db
        .select()
        .from(sysMemberWallet)
        .where(and(eq(sysMemberWallet.userId, userId), eq(sysMemberWallet.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    /** 排他锁读取：必须在事务内调用，用于「先校验后变更」的资金链路 */
    async lockByUserId(userId: string): Promise<WalletRow | null> {
      const rows = await db
        .select()
        .from(sysMemberWallet)
        .where(and(eq(sysMemberWallet.userId, userId), eq(sysMemberWallet.isDeleted, 0)))
        .limit(1)
        .for('update')

      return rows[0] ?? null
    },

    async insert(values: WalletInsert) {
      return await db.insert(sysMemberWallet).values(values)
    },

    /**
     * 入账：余额 + 累计值。
     * 仅充值走 `totalRecharge`，赠送走 `totalGift`，两者可同时为空。
     */
    async credit(input: {
      userId: string
      account: 'recharge' | 'gift'
      amount: string
      operatorId: string | null
      countRechargeTotal?: boolean
      countGiftTotal?: boolean
    }) {
      const balanceField = input.account === 'recharge'
        ? { rechargeBalance: sql`${sysMemberWallet.rechargeBalance} + ${input.amount}` }
        : { giftBalance: sql`${sysMemberWallet.giftBalance} + ${input.amount}` }

      const totals: Record<string, unknown> = {}
      if (input.countRechargeTotal) {
        totals.totalRecharge = sql`${sysMemberWallet.totalRecharge} + ${input.amount}`
      }
      if (input.countGiftTotal) {
        totals.totalGift = sql`${sysMemberWallet.totalGift} + ${input.amount}`
      }

      const result: unknown = await db
        .update(sysMemberWallet)
        .set({ ...balanceField, ...totals, updatedBy: input.operatorId })
        .where(and(eq(sysMemberWallet.userId, input.userId), eq(sysMemberWallet.isDeleted, 0)))

      return affectedRows(result)
    },

    /**
     * 预扣冻结：可用余额必须够，否则 0 行受影响（调用方抛「余额不足」）。
     * 条件里的守卫是并发安全的最后一道保险。
     */
    async freezeFunds(input: {
      userId: string
      giftAmount: string
      rechargeAmount: string
      operatorId: string | null
    }) {
      const result: unknown = await db
        .update(sysMemberWallet)
        .set({
          frozenGift: sql`${sysMemberWallet.frozenGift} + ${input.giftAmount}`,
          frozenRecharge: sql`${sysMemberWallet.frozenRecharge} + ${input.rechargeAmount}`,
          updatedBy: input.operatorId
        })
        .where(and(
          eq(sysMemberWallet.userId, input.userId),
          eq(sysMemberWallet.isDeleted, 0),
          sql`${sysMemberWallet.giftBalance} - ${sysMemberWallet.frozenGift} >= ${input.giftAmount}`,
          sql`${sysMemberWallet.rechargeBalance} - ${sysMemberWallet.frozenRecharge} >= ${input.rechargeAmount}`
        ))

      return affectedRows(result)
    },

    /** 释放冻结：只减冻结额，不动余额 */
    async releaseFunds(input: {
      userId: string
      giftAmount: string
      rechargeAmount: string
      operatorId: string | null
    }) {
      const result: unknown = await db
        .update(sysMemberWallet)
        .set({
          frozenGift: sql`${sysMemberWallet.frozenGift} - ${input.giftAmount}`,
          frozenRecharge: sql`${sysMemberWallet.frozenRecharge} - ${input.rechargeAmount}`,
          updatedBy: input.operatorId
        })
        .where(and(
          eq(sysMemberWallet.userId, input.userId),
          eq(sysMemberWallet.isDeleted, 0),
          sql`${sysMemberWallet.frozenGift} >= ${input.giftAmount}`,
          sql`${sysMemberWallet.frozenRecharge} >= ${input.rechargeAmount}`
        ))

      return affectedRows(result)
    },

    /** 确认实扣：扣余额 + 减冻结 + 累计消费 */
    async settleFrozen(input: {
      userId: string
      giftAmount: string
      rechargeAmount: string
      operatorId: string | null
    }) {
      const result: unknown = await db
        .update(sysMemberWallet)
        .set({
          giftBalance: sql`${sysMemberWallet.giftBalance} - ${input.giftAmount}`,
          rechargeBalance: sql`${sysMemberWallet.rechargeBalance} - ${input.rechargeAmount}`,
          frozenGift: sql`${sysMemberWallet.frozenGift} - ${input.giftAmount}`,
          frozenRecharge: sql`${sysMemberWallet.frozenRecharge} - ${input.rechargeAmount}`,
          totalConsume: sql`${sysMemberWallet.totalConsume} + ${input.giftAmount} + ${input.rechargeAmount}`,
          updatedBy: input.operatorId
        })
        .where(and(
          eq(sysMemberWallet.userId, input.userId),
          eq(sysMemberWallet.isDeleted, 0),
          sql`${sysMemberWallet.giftBalance} >= ${input.giftAmount}`,
          sql`${sysMemberWallet.rechargeBalance} >= ${input.rechargeAmount}`,
          sql`${sysMemberWallet.frozenGift} >= ${input.giftAmount}`,
          sql`${sysMemberWallet.frozenRecharge} >= ${input.rechargeAmount}`
        ))

      return affectedRows(result)
    },

    /** 扣减余额（手工调账出账、赠送金过期扣减共用），余额不足则 0 行受影响 */
    async decreaseBalance(input: {
      userId: string
      account: 'recharge' | 'gift'
      amount: string
      operatorId: string | null
    }) {
      const balanceField = input.account === 'recharge'
        ? { rechargeBalance: sql`${sysMemberWallet.rechargeBalance} - ${input.amount}` }
        : { giftBalance: sql`${sysMemberWallet.giftBalance} - ${input.amount}` }

      const guard = input.account === 'recharge'
        ? sql`${sysMemberWallet.rechargeBalance} >= ${input.amount}`
        : sql`${sysMemberWallet.giftBalance} >= ${input.amount}`

      const result: unknown = await db
        .update(sysMemberWallet)
        .set({ ...balanceField, updatedBy: input.operatorId })
        .where(and(
          eq(sysMemberWallet.userId, input.userId),
          eq(sysMemberWallet.isDeleted, 0),
          guard
        ))

      return affectedRows(result)
    },

    /** 对账用：全部钱包行（只取必要列，避免大字段） */
    async listAllForReconcile() {
      return await db
        .select({
          userId: sysMemberWallet.userId,
          rechargeBalance: sysMemberWallet.rechargeBalance,
          giftBalance: sysMemberWallet.giftBalance,
          frozenRecharge: sysMemberWallet.frozenRecharge,
          frozenGift: sysMemberWallet.frozenGift
        })
        .from(sysMemberWallet)
        .where(eq(sysMemberWallet.isDeleted, 0))
    }
  }
}

export type WalletRepo = ReturnType<typeof walletRepo>
