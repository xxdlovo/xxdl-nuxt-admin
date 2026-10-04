/**
 * 会员开通单 mapper（数据访问层）—— `sys_member_level_order` 的**唯一**写入点。
 *
 * 状态机：`WP 待支付 → OD 已生效`（等级已写回 sys_member）/ `CL 已关闭` / `FL 发起失败`。
 *
 * 幂等：
 * - `uk_member_level_order_request`（request_id）保证「同一提交（requestId）只落一单」，
 *   入口与并发冲突回落都走 `findByRequestId` 回读原单；
 * - `uk_member_level_order_out`（out_trade_no）保证单据号唯一；
 * - 「同一单据只生效一次」由 `markPaid` 的条件更新 `status = 'WP' → 'OD'` 承担 ——
 *   affectedRows = 0 表示并发下已被别的请求推进，调用方按「已生效（reused）」返回。
 *
 * 注意 `expire_at` 是**支付超时**，与 `sys_member.expire_at`（等级到期）语义不同。
 */
import { and, desc, eq } from 'drizzle-orm'
import { sysMemberLevelOrder } from '#server/drizzle/schema'
import { asDb, type AppExecutor } from '#server/drizzle/db'
import { affectedRows } from '../../wallet/repo/sqlUtils'

export type LevelOrderRow = typeof sysMemberLevelOrder.$inferSelect
export type LevelOrderInsert = typeof sysMemberLevelOrder.$inferInsert

/** 待支付 */
const STATUS_PENDING = 'WP'
/** 已生效 */
const STATUS_ACTIVE = 'OD'
/** 免费等级固定写入的支付方式（见 createFreeTx） */
const PAY_MODE_FREE = 'free'

export function levelOrderRepo(executor: AppExecutor) {
  const db = asDb(executor)

  return {
    async insert(values: LevelOrderInsert) {
      return await db.insert(sysMemberLevelOrder).values(values)
    },

    async findById(id: string): Promise<LevelOrderRow | null> {
      const rows = await db
        .select()
        .from(sysMemberLevelOrder)
        .where(and(eq(sysMemberLevelOrder.id, id), eq(sysMemberLevelOrder.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    async findByOutTradeNo(outTradeNo: string): Promise<LevelOrderRow | null> {
      const rows = await db
        .select()
        .from(sysMemberLevelOrder)
        .where(and(
          eq(sysMemberLevelOrder.outTradeNo, outTradeNo),
          eq(sysMemberLevelOrder.isDeleted, 0)
        ))
        .limit(1)

      return rows[0] ?? null
    },

    /**
     * 按提交幂等键取单据（`uk_member_level_order_request`）。
     *
     * **刻意不过滤 is_deleted**：与 `orderRepo.findByRequestId` 一致 ——
     * 单据被软删后前端拿同一个 requestId 再提交，应当命中同一单并提示「已存在」，
     * 而不是重新落一单（唯一索引本身也不区分是否删除）。
     */
    async findByRequestId(requestId: string): Promise<LevelOrderRow | null> {
      const rows = await db
        .select()
        .from(sysMemberLevelOrder)
        .where(eq(sysMemberLevelOrder.requestId, requestId))
        .limit(1)

      return rows[0] ?? null
    },

    /**
     * 同一用户 + 同一等级 + 同一支付方式的待支付单据（最新的那一条）。
     *
     * 用途：在线支付的**第二道兜底复用**（第一道是 `findByRequestId` 的提交级幂等）。
     * 它只覆盖「前端每次点击都换了一个新 requestId」的场景：命中就复用原单与它的二维码，
     * 避免连点两次生成两张都可支付的二维码。
     */
    async findPending(input: {
      userId: string
      levelId: string
      payMode: string
    }): Promise<LevelOrderRow | null> {
      const rows = await db
        .select()
        .from(sysMemberLevelOrder)
        .where(and(
          eq(sysMemberLevelOrder.userId, input.userId),
          eq(sysMemberLevelOrder.levelId, input.levelId),
          eq(sysMemberLevelOrder.payMode, input.payMode),
          eq(sysMemberLevelOrder.status, STATUS_PENDING),
          eq(sysMemberLevelOrder.isDeleted, 0)
        ))
        .orderBy(desc(sysMemberLevelOrder.createdAt))
        .limit(1)

      return rows[0] ?? null
    },

    /** 余额支付：回填冻结单 id（冻结单的 attach 反向存 orderId，用于 requestId 幂等回溯） */
    async attachFreeze(input: {
      id: string
      freezeId: string
      operatorId: string | null
    }) {
      const result: unknown = await db
        .update(sysMemberLevelOrder)
        .set({ freezeId: input.freezeId, updatedBy: input.operatorId })
        .where(and(eq(sysMemberLevelOrder.id, input.id), eq(sysMemberLevelOrder.status, STATUS_PENDING)))

      return affectedRows(result)
    },

    /** 在线支付：回填支付单信息（支付单已落到渠道侧，回填失败不能把单据置 FL） */
    async attachPayOrder(input: {
      id: string
      payOrderId: string
      payChannelCode: string | null
      expireAt: string | null
      operatorId: string | null
    }) {
      const result: unknown = await db
        .update(sysMemberLevelOrder)
        .set({
          payOrderId: input.payOrderId,
          payChannelCode: input.payChannelCode,
          expireAt: input.expireAt,
          updatedBy: input.operatorId
        })
        .where(and(eq(sysMemberLevelOrder.id, input.id), eq(sysMemberLevelOrder.status, STATUS_PENDING)))

      return affectedRows(result)
    },

    /**
     * `WP → OD`：**唯一生效闸门**。等级写回与它同事务，
     * affectedRows = 0 即并发下已生效/已终结，调用方按幂等返回，不再重复顺延期限。
     */
    async markPaid(input: {
      id: string
      paidAt: string
      effectiveAt: string
      startAt: string
      endAt: string | null
      operatorId: string | null
    }) {
      const result: unknown = await db
        .update(sysMemberLevelOrder)
        .set({
          status: STATUS_ACTIVE,
          paidAt: input.paidAt,
          effectiveAt: input.effectiveAt,
          startAt: input.startAt,
          endAt: input.endAt,
          failReason: null,
          updatedBy: input.operatorId
        })
        .where(and(
          eq(sysMemberLevelOrder.id, input.id),
          eq(sysMemberLevelOrder.status, STATUS_PENDING)
        ))

      return affectedRows(result)
    },

    /** 关闭未生效单据（仅 WP 可关，CL 幂等返回 0） */
    async markClosed(input: { id: string, reason: string | null, operatorId: string | null }) {
      const result: unknown = await db
        .update(sysMemberLevelOrder)
        .set({ status: 'CL', failReason: input.reason, updatedBy: input.operatorId })
        .where(and(
          eq(sysMemberLevelOrder.id, input.id),
          eq(sysMemberLevelOrder.status, STATUS_PENDING)
        ))

      return affectedRows(result)
    },

    /** 发起支付失败（仅 WP 可置 FL；余额与冻结不动） */
    async markFailed(input: { id: string, reason: string | null, operatorId: string | null }) {
      const result: unknown = await db
        .update(sysMemberLevelOrder)
        .set({ status: 'FL', failReason: input.reason, updatedBy: input.operatorId })
        .where(and(
          eq(sysMemberLevelOrder.id, input.id),
          eq(sysMemberLevelOrder.status, STATUS_PENDING)
        ))

      return affectedRows(result)
    },

    /** 我的开通记录（会员自助列表） */
    async listByUser(userId: string, limit = 100): Promise<LevelOrderRow[]> {
      return await db
        .select()
        .from(sysMemberLevelOrder)
        .where(and(
          eq(sysMemberLevelOrder.userId, userId),
          eq(sysMemberLevelOrder.isDeleted, 0)
        ))
        .orderBy(desc(sysMemberLevelOrder.createdAt))
        .limit(limit)
    },

    /**
     * 该用户是否已有过**该等级的免费成功单据**。
     *
     * 条件：`user_id` + `level_id` + `pay_mode = 'free'` + `status = 'OD'` + `is_deleted = 0`。
     * 用途：0 元等级不支持重复开通 / 续费 —— 免费单据生效过一次即视为「已开通」，
     * 即使之后被后台降级/到期，也不再允许重复薅同一张免费等级。
     */
    async existsFreePaidOrder(userId: string, levelId: string): Promise<boolean> {
      const rows = await db
        .select({ id: sysMemberLevelOrder.id })
        .from(sysMemberLevelOrder)
        .where(and(
          eq(sysMemberLevelOrder.userId, userId),
          eq(sysMemberLevelOrder.levelId, levelId),
          eq(sysMemberLevelOrder.payMode, PAY_MODE_FREE),
          eq(sysMemberLevelOrder.status, STATUS_ACTIVE),
          eq(sysMemberLevelOrder.isDeleted, 0)
        ))
        .limit(1)

      return Boolean(rows[0])
    },

    /**
     * 该用户有过免费成功单据的等级 id 列表（去重在调用方用 Set 处理）。
     *
     * 与 `existsFreePaidOrder` 同条件，只把「单等级查询」换成「一次取全部」，
     * 供 `myLevelOptions` 批量判定，避免按等级数发 N 条查询。
     */
    async listFreePaidLevelIds(userId: string): Promise<string[]> {
      const rows = await db
        .select({ levelId: sysMemberLevelOrder.levelId })
        .from(sysMemberLevelOrder)
        .where(and(
          eq(sysMemberLevelOrder.userId, userId),
          eq(sysMemberLevelOrder.payMode, PAY_MODE_FREE),
          eq(sysMemberLevelOrder.status, STATUS_ACTIVE),
          eq(sysMemberLevelOrder.isDeleted, 0)
        ))

      return rows.map(row => row.levelId)
    }
  }
}

export type LevelOrderRepo = ReturnType<typeof levelOrderRepo>
