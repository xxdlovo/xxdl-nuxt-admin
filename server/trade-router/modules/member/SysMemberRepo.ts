//#server/trade-router/modules/member
/**
 * 会员档案 mapper（模块层，ctx 版）。
 *
 * 与领域层 `domain/member/repo/memberRepo.ts` 的分工：
 * - 领域 mapper 只服务资金/会员规则（按 userId 取单行）；
 * - 本文件服务后台列表页：联表取昵称、联系方式、等级名与钱包余额，
 *   并统一叠加数据权限（`buildScopedWhere`）。
 */
import { and, asc, count, desc, eq, gte, like, lte, or, type SQL } from 'drizzle-orm'
import { getTableColumns } from 'drizzle-orm'
import { CommonRepo } from '#server/drizzle/CommonRepo'
import { sysMember, sysMemberLevel, sysMemberWallet, sysUser } from '~~/server/drizzle/schema'
import { SysMemberBaseSchema } from '#shared/system/member/common'
import { buildScopedWhere } from '#server/drizzle/queries/buildScope'
import type { Context } from '#server/trpc/context'

const commonRepo = CommonRepo(sysMember, SysMemberBaseSchema)

/** 会员列表筛选项（多为非表字段，由本 Repo 手工组装） */
export type SysMemberListFilters = {
  keyword?: string | null
  levelId?: string | null
  inviterId?: string | null
  status?: number | null
  createdFrom?: string | null
  createdTo?: string | null
}

/** 列表与详情共用的展示列：会员 + 用户 + 等级 + 钱包 */
const profileColumns = {
  ...getTableColumns(sysMember),
  nickname: sysUser.nickname,
  username: sysUser.username,
  phone: sysUser.phone,
  email: sysUser.email,
  userStatus: sysUser.status,
  levelName: sysMemberLevel.name,
  rechargeBalance: sysMemberWallet.rechargeBalance,
  giftBalance: sysMemberWallet.giftBalance,
  frozenRecharge: sysMemberWallet.frozenRecharge,
  frozenGift: sysMemberWallet.frozenGift,
  totalRecharge: sysMemberWallet.totalRecharge,
  totalGift: sysMemberWallet.totalGift,
  totalConsume: sysMemberWallet.totalConsume
}

export const sysMemberRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  /** 组装筛选条件（数据权限由 buildScopedWhere 统一叠加） */
  async function buildConditions(filters: SysMemberListFilters) {
    const conditions: SQL[] = []

    if (filters.keyword) {
      const keyword = `%${filters.keyword}%`
      const keywordWhere = or(
        like(sysUser.nickname, keyword),
        like(sysUser.username, keyword),
        like(sysUser.phone, keyword),
        like(sysMember.inviteCode, keyword)
      )

      if (keywordWhere) {
        conditions.push(keywordWhere)
      }
    }
    if (filters.levelId) {
      conditions.push(eq(sysMember.levelId, filters.levelId))
    }
    if (filters.inviterId) {
      conditions.push(eq(sysMember.inviterId, filters.inviterId))
    }
    if (filters.status !== null && filters.status !== undefined) {
      conditions.push(eq(sysMember.status, filters.status))
    }
    if (filters.createdFrom) {
      conditions.push(gte(sysMember.createdAt, filters.createdFrom))
    }
    if (filters.createdTo) {
      conditions.push(lte(sysMember.createdAt, filters.createdTo))
    }

    return await buildScopedWhere(sysMember, ctx, ...conditions)
  }

  return {
    ...repo,

    /** 会员列表：联表分页，按注册时间倒序 */
    async pageWithProfile(
      page: number,
      pageSize: number,
      filters: SysMemberListFilters = {}
    ) {
      const where = await buildConditions(filters)

      const totalRows = await ctx.db
        .select({ total: count() })
        .from(sysMember)
        .leftJoin(sysUser, eq(sysUser.id, sysMember.userId))
        .leftJoin(sysMemberLevel, eq(sysMemberLevel.id, sysMember.levelId))
        .where(where)

      const list = await ctx.db
        .select(profileColumns)
        .from(sysMember)
        .leftJoin(sysUser, eq(sysUser.id, sysMember.userId))
        .leftJoin(sysMemberLevel, eq(sysMemberLevel.id, sysMember.levelId))
        .leftJoin(sysMemberWallet, eq(sysMemberWallet.userId, sysMember.userId))
        .where(where)
        .orderBy(desc(sysMember.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize)

      return { total: Number(totalRows[0]?.total ?? 0), page, pageSize, list }
    },

    /** 单个会员的完整档案（详情页 / 自助页共用） */
    async getProfileByUserId(userId: string) {
      const rows = await ctx.db
        .select(profileColumns)
        .from(sysMember)
        .leftJoin(sysUser, eq(sysUser.id, sysMember.userId))
        .leftJoin(sysMemberLevel, eq(sysMemberLevel.id, sysMember.levelId))
        .leftJoin(sysMemberWallet, eq(sysMemberWallet.userId, sysMember.userId))
        .where(and(eq(sysMember.userId, userId), eq(sysMember.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    /** 按会员档案 id 取详情 */
    async getProfileById(id: string) {
      const rows = await ctx.db
        .select(profileColumns)
        .from(sysMember)
        .leftJoin(sysUser, eq(sysUser.id, sysMember.userId))
        .leftJoin(sysMemberLevel, eq(sysMemberLevel.id, sysMember.levelId))
        .leftJoin(sysMemberWallet, eq(sysMemberWallet.userId, sysMember.userId))
        .where(and(eq(sysMember.id, id), eq(sysMember.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    /** 我邀请的下级（含昵称与等级名） */
    async listInvitees(inviterId: string, limit = 200) {
      return await ctx.db
        .select(profileColumns)
        .from(sysMember)
        .leftJoin(sysUser, eq(sysUser.id, sysMember.userId))
        .leftJoin(sysMemberLevel, eq(sysMemberLevel.id, sysMember.levelId))
        .leftJoin(sysMemberWallet, eq(sysMemberWallet.userId, sysMember.userId))
        .where(and(eq(sysMember.inviterId, inviterId), eq(sysMember.isDeleted, 0)))
        .orderBy(asc(sysMember.createdAt))
        .limit(limit)
    },

    /** 邀请码是否已被占用（手工建档预检） */
    async existsInviteCode(inviteCode: string) {
      const rows = await ctx.db
        .select({ id: sysMember.id })
        .from(sysMember)
        .where(eq(sysMember.inviteCode, inviteCode))
        .limit(1)

      return Boolean(rows[0])
    }
  }
}

export type SysMemberRepo = ReturnType<typeof sysMemberRepo>
