//#server/trade-router/modules/memberLevelOrder
/**
 * 会员开通单 mapper（模块层，ctx 版）。
 *
 * 与领域层 `domain/member/repo/levelOrderRepo.ts` 的分工：
 * - 领域 mapper 只服务开通 / 生效状态机（按 id、单号、requestId 取单）；
 * - 本文件服务后台列表页：联表取会员昵称 / 账号 / 手机号，并统一叠加数据权限
 *   （`buildScopedWhere`），口径与 `SysOrderRepo` / `SysMemberRechargeRepo` 一致。
 *
 * 约定：SQL 只出现在 Repo；Service 只做参数收敛与领域调用。
 */
import { count, desc, eq, getTableColumns, gte, lte, type SQL } from 'drizzle-orm'
import { CommonRepo } from '#server/drizzle/CommonRepo'
import { buildScopedWhere } from '#server/drizzle/queries/buildScope'
import { buildWhereBySchema } from '#server/drizzle/queries/buildWhereBySchema'
import { sysMemberLevelOrder, sysUser } from '~~/server/drizzle/schema'
import { SysMemberLevelOrderBaseSchema } from '#shared/system/memberLevelOrder/common'
import type { Context } from '#server/trpc/context'

const commonRepo = CommonRepo(sysMemberLevelOrder, SysMemberLevelOrderBaseSchema)

/** 列表筛选项里的区间部分（非表字段，由本 Repo 手工组装） */
export type SysMemberLevelOrderRangeQuery = {
  /** 开通时间区间，打在 sysMemberLevelOrder.createdAt */
  createdFrom?: string | null
  createdTo?: string | null
}

/** 列表与详情共用的展示列：开通单本体 + 用户展示字段 */
const profileColumns = {
  ...getTableColumns(sysMemberLevelOrder),
  nickname: sysUser.nickname,
  username: sysUser.username,
  phone: sysUser.phone
}

export const sysMemberLevelOrderRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  /** 表字段条件交给 Schema 统一生成（outTradeNo=like、状态/支付方式=等值），时间区间走 extraWhere */
  async function buildConditions(dto: Record<string, unknown>, range: SysMemberLevelOrderRangeQuery) {
    const conditions: SQL[] = buildWhereBySchema(SysMemberLevelOrderBaseSchema, sysMemberLevelOrder, dto)

    if (range.createdFrom) {
      conditions.push(gte(sysMemberLevelOrder.createdAt, range.createdFrom))
    }
    if (range.createdTo) {
      conditions.push(lte(sysMemberLevelOrder.createdAt, range.createdTo))
    }

    return await buildScopedWhere(sysMemberLevelOrder, ctx, ...conditions)
  }

  return {
    ...repo,

    /** 后台开通记录列表：联表分页，按开通时间倒序 */
    async pageWithProfile(
      page: number,
      pageSize: number,
      dto: Record<string, unknown> = {},
      range: SysMemberLevelOrderRangeQuery = {}
    ) {
      const where = await buildConditions(dto, range)

      const totalRows = await ctx.db
        .select({ total: count() })
        .from(sysMemberLevelOrder)
        .leftJoin(sysUser, eq(sysUser.id, sysMemberLevelOrder.userId))
        .where(where)

      const list = await ctx.db
        .select(profileColumns)
        .from(sysMemberLevelOrder)
        .leftJoin(sysUser, eq(sysUser.id, sysMemberLevelOrder.userId))
        .where(where)
        .orderBy(desc(sysMemberLevelOrder.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize)

      return { total: Number(totalRows[0]?.total ?? 0), page, pageSize, list }
    },

    /**
     * 单条开通记录的完整展示行（后台详情）。
     * 与列表同样叠加数据权限，口径与 `CommonRepo.getById` 保持一致。
     */
    async getProfileById(id: string) {
      const where = await buildScopedWhere(sysMemberLevelOrder, ctx, eq(sysMemberLevelOrder.id, id))

      const rows = await ctx.db
        .select(profileColumns)
        .from(sysMemberLevelOrder)
        .leftJoin(sysUser, eq(sysUser.id, sysMemberLevelOrder.userId))
        .where(where)
        .limit(1)

      return rows[0] ?? null
    }
  }
}

export type SysMemberLevelOrderRepo = ReturnType<typeof sysMemberLevelOrderRepo>
