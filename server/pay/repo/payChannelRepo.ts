/**
 * 支付渠道 mapper（数据访问层）。
 *
 * 与 payOrderRepo 同样接收 `PayDb`：
 * - PayChannelResolver（下单/查询/回调都要用）、payTest 模块、渠道配置模块共用同一份查询；
 * - 只做查询，不做「渠道是否可用/是否已验证」这类业务判断。
 */
import { and, asc, desc, eq, ne } from 'drizzle-orm'
import { sysPayChannel } from '#server/drizzle/schema'
import type { PayDb } from '../db'

export type PayChannelRow = typeof sysPayChannel.$inferSelect

/** 对外（前端组件/测试页）可见的渠道字段：不含任何密钥 */
export type PayChannelPublicRow = {
  id: string
  configName: string
  channelCode: string
  mode: string
  currency: string
  isDefault: number
  verifyStatus: number | null
  notifyUrl: string | null
}

export type PayChannelFindOptions = {
  channelId?: string | null
  channelCode?: string | null
  currency?: string | null
}

export function payChannelRepo(db: PayDb) {
  return {
    /** 按主键取（不过滤 status，保持「已停用渠道的历史订单仍可查询」的语义） */
    async findById(channelId: string): Promise<PayChannelRow | null> {
      const rows = await db
        .select()
        .from(sysPayChannel)
        .where(and(eq(sysPayChannel.id, channelId), eq(sysPayChannel.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    /**
     * 取一个启用中的渠道：显式 id / channelCode / currency 依次收窄，
     * 排序为「默认优先 → sortOrder 升序 → 创建时间升序」。
     */
    async findEnabled(options: PayChannelFindOptions = {}): Promise<PayChannelRow | null> {
      const conditions = [eq(sysPayChannel.isDeleted, 0), eq(sysPayChannel.status, 1)]

      if (options.channelId) {
        conditions.push(eq(sysPayChannel.id, options.channelId))
      }
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

      return rows[0] ?? null
    },

    /** 同一 channelCode 可能配置了多个账户，回调验签需要逐个尝试 */
    async listEnabledByCode(channelCode: string): Promise<PayChannelRow[]> {
      return await db
        .select()
        .from(sysPayChannel)
        .where(and(
          eq(sysPayChannel.isDeleted, 0),
          eq(sysPayChannel.status, 1),
          eq(sysPayChannel.channelCode, channelCode.trim().toLowerCase())
        ))
        .orderBy(desc(sysPayChannel.isDefault), asc(sysPayChannel.sortOrder), asc(sysPayChannel.createdAt))
    },

    /** 启用中的渠道公开列表（测试页下拉 / ScanPay 组件解析渠道用） */
    async listEnabledPublic(): Promise<PayChannelPublicRow[]> {
      return await db
        .select({
          id: sysPayChannel.id,
          configName: sysPayChannel.configName,
          channelCode: sysPayChannel.channelCode,
          mode: sysPayChannel.mode,
          currency: sysPayChannel.currency,
          isDefault: sysPayChannel.isDefault,
          verifyStatus: sysPayChannel.verifyStatus,
          notifyUrl: sysPayChannel.notifyUrl
        })
        .from(sysPayChannel)
        .where(and(
          eq(sysPayChannel.isDeleted, 0),
          eq(sysPayChannel.status, 1)
        ))
        .orderBy(desc(sysPayChannel.isDefault), asc(sysPayChannel.sortOrder))
    },

    /** 只取渠道名（组装响应时避免把整行拉出来） */
    async findNameById(channelId: string): Promise<string | null> {
      const rows = await db
        .select({ configName: sysPayChannel.configName })
        .from(sysPayChannel)
        .where(eq(sysPayChannel.id, channelId))
        .limit(1)

      return rows[0]?.configName ?? null
    },

    /** 设为默认渠道前清掉其他行的默认标记 */
    async clearOtherDefaults(excludeId: string, operatorId: string | null) {
      return await db
        .update(sysPayChannel)
        .set({ isDefault: 0, updatedBy: operatorId })
        .where(and(
          eq(sysPayChannel.isDeleted, 0),
          ne(sysPayChannel.id, excludeId)
        ))
    }
  }
}

export type PayChannelRepo = ReturnType<typeof payChannelRepo>
