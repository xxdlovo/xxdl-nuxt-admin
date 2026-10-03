//#server/trade-router/modules/order
/**
 * 订单 mapper（模块层，ctx 版）。
 *
 * 与领域层 `domain/order/repo/orderRepo.ts` 的分工：
 * - 领域 mapper 只服务下单与支付/履约状态机（按 id、订单号、requestId 取单）；
 * - 本文件服务后台列表页：联表取会员昵称、账号、手机号与等级名，
 *   并统一叠加数据权限（`buildScopedWhere`）。
 *
 * 约定：SQL 只出现在 Repo；Service 只做参数收敛与领域调用。
 */
import { count, desc, eq, getTableColumns, gte, lte, type SQL } from 'drizzle-orm'
import { CommonRepo } from '#server/drizzle/CommonRepo'
import { buildScopedWhere } from '#server/drizzle/queries/buildScope'
import { buildWhereBySchema } from '#server/drizzle/queries/buildWhereBySchema'
import { sysMemberLevel, sysOrder, sysUser } from '~~/server/drizzle/schema'
import { SysOrderBaseSchema } from '#shared/system/order/common'
import type { Context } from '#server/trpc/context'

const commonRepo = CommonRepo(sysOrder, SysOrderBaseSchema)

/** 列表筛选项里的区间部分（非表字段，由本 Repo 手工组装） */
export type SysOrderRangeQuery = {
  /** 应付金额区间，打在 sysOrder.payAmount */
  amountMin?: string | number | null
  amountMax?: string | number | null
  /** 下单时间区间，打在 sysOrder.createdAt */
  createdFrom?: string | null
  createdTo?: string | null
}

/** 列表与详情共用的展示列：订单 + 用户 + 等级 */
const profileColumns = {
  ...getTableColumns(sysOrder),
  nickname: sysUser.nickname,
  username: sysUser.username,
  phone: sysUser.phone,
  levelName: sysMemberLevel.name
}

export const sysOrderRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  /**
   * 组装筛选条件：表字段交给 Schema 统一生成（eq / like），
   * 金额与时间区间通过 extraWhere 追加，最后叠加数据权限。
   */
  async function buildConditions(dto: Record<string, unknown>, range: SysOrderRangeQuery) {
    const conditions: SQL[] = buildWhereBySchema(SysOrderBaseSchema, sysOrder, dto)

    if (range.amountMin) {
      conditions.push(gte(sysOrder.payAmount, String(range.amountMin)))
    }
    if (range.amountMax) {
      conditions.push(lte(sysOrder.payAmount, String(range.amountMax)))
    }
    if (range.createdFrom) {
      conditions.push(gte(sysOrder.createdAt, range.createdFrom))
    }
    if (range.createdTo) {
      conditions.push(lte(sysOrder.createdAt, range.createdTo))
    }

    return await buildScopedWhere(sysOrder, ctx, ...conditions)
  }

  return {
    ...repo,

    /**
     * 后台订单列表：联表分页，按创建时间倒序。
     * 订单只允许按支付状态与履约状态筛选，金额/时间区间分别打在 payAmount 与 createdAt。
     */
    async pageWithProfile(
      page: number,
      pageSize: number,
      dto: Record<string, unknown> = {},
      range: SysOrderRangeQuery = {}
    ) {
      const where = await buildConditions(dto, range)

      const totalRows = await ctx.db
        .select({ total: count() })
        .from(sysOrder)
        .leftJoin(sysUser, eq(sysUser.id, sysOrder.userId))
        .leftJoin(sysMemberLevel, eq(sysMemberLevel.id, sysOrder.levelId))
        .where(where)

      const list = await ctx.db
        .select(profileColumns)
        .from(sysOrder)
        .leftJoin(sysUser, eq(sysUser.id, sysOrder.userId))
        .leftJoin(sysMemberLevel, eq(sysMemberLevel.id, sysOrder.levelId))
        .where(where)
        .orderBy(desc(sysOrder.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize)

      return { total: Number(totalRows[0]?.total ?? 0), page, pageSize, list }
    },

    /**
     * 单个订单的完整档案（后台详情页，含昵称与等级名）。
     * 与列表同样叠加数据权限，口径与 CommonRepo.getById 保持一致。
     */
    async getProfileById(id: string) {
      const where = await buildScopedWhere(sysOrder, ctx, eq(sysOrder.id, id))

      const rows = await ctx.db
        .select(profileColumns)
        .from(sysOrder)
        .leftJoin(sysUser, eq(sysUser.id, sysOrder.userId))
        .leftJoin(sysMemberLevel, eq(sysMemberLevel.id, sysOrder.levelId))
        .where(where)
        .limit(1)

      return rows[0] ?? null
    }
  }
}

export type SysOrderRepo = ReturnType<typeof sysOrderRepo>
