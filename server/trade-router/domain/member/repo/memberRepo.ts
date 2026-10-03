/**
 * 会员档案 mapper（数据访问层）。
 */
import { and, asc, desc, eq, inArray, isNotNull, isNull, like, or, sql } from 'drizzle-orm'
import { sysConfig, sysMember, sysUser } from '#server/drizzle/schema'
import { asDb, type AppExecutor } from '#server/drizzle/db'
import { affectedRows } from '../../wallet/repo/sqlUtils'

export type MemberRow = typeof sysMember.$inferSelect
export type MemberInsert = typeof sysMember.$inferInsert

export function memberRepo(executor: AppExecutor) {
  const db = asDb(executor)

  return {
    async insert(values: MemberInsert) {
      return await db.insert(sysMember).values(values)
    },

    /**
     * 还没有会员档案的有效用户（按注册先后取一批），供补齐任务使用。
     * 用 left join + is null 判定「缺档案」，避免逐条查询。
     */
    async listUserIdsWithoutProfile(limit: number): Promise<string[]> {
      const rows = await db
        .select({ userId: sysUser.id })
        .from(sysUser)
        .leftJoin(sysMember, eq(sysMember.userId, sysUser.id))
        .where(and(eq(sysUser.isDeleted, 0), isNull(sysMember.id)))
        .orderBy(asc(sysUser.createdAt))
        .limit(limit)

      return rows.map(row => row.userId)
    },

    /**
     * 用户下拉搜索（后台选择会员用）。
     *
     * - `scope = 'member'`：只列已有会员档案的用户（补录充值、流水筛选等场景）
     * - `scope = 'unprofiled'`：只列还没有档案的用户（会员建档场景，避免选到已有档案的人）
     * - 关键字同时匹配用户名 / 昵称 / 手机号，若整串是完整用户ID则精确命中
     */
    async searchUserOptions(params: {
      keyword?: string | null
      limit: number
      scope: 'member' | 'unprofiled'
    }): Promise<Array<{ value: string, label: string, phone: string | null, nickname: string | null, username: string | null }>> {
      const conditions = [eq(sysUser.isDeleted, 0)]
      const keyword = String(params.keyword ?? '').trim()

      if (keyword) {
        const pattern = `%${keyword}%`
        const matched = or(
          eq(sysUser.id, keyword),
          like(sysUser.username, pattern),
          like(sysUser.nickname, pattern),
          like(sysUser.phone, pattern)
        )

        if (matched) {
          conditions.push(matched)
        }
      }

      conditions.push(params.scope === 'member' ? isNotNull(sysMember.id) : isNull(sysMember.id))

      const rows = await db
        .select({
          userId: sysUser.id,
          username: sysUser.username,
          nickname: sysUser.nickname,
          phone: sysUser.phone
        })
        .from(sysUser)
        .leftJoin(sysMember, eq(sysMember.userId, sysUser.id))
        .where(and(...conditions))
        .orderBy(desc(sysUser.createdAt))
        .limit(params.limit)

      return rows.map((row) => {
        const name = row.nickname || row.username || row.userId
        const suffix = row.phone ? ` · ${row.phone}` : ''

        return {
          value: row.userId,
          label: `${name}${suffix}`,
          phone: row.phone ?? null,
          nickname: row.nickname ?? null,
          username: row.username ?? null
        }
      })
    },

    async findByUserId(userId: string): Promise<MemberRow | null> {
      const rows = await db
        .select()
        .from(sysMember)
        .where(and(eq(sysMember.userId, userId), eq(sysMember.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    async findById(id: string): Promise<MemberRow | null> {
      const rows = await db
        .select()
        .from(sysMember)
        .where(and(eq(sysMember.id, id), eq(sysMember.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    async findByInviteCode(inviteCode: string): Promise<MemberRow | null> {
      const rows = await db
        .select()
        .from(sysMember)
        .where(and(eq(sysMember.inviteCode, inviteCode), eq(sysMember.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    /** 批量取会员（列表页避免 N+1） */
    async listByUserIds(userIds: string[]): Promise<MemberRow[]> {
      if (userIds.length === 0) {
        return []
      }

      return await db
        .select()
        .from(sysMember)
        .where(and(inArray(sysMember.userId, userIds), eq(sysMember.isDeleted, 0)))
    },

    /** 绑定上级：仅当尚未绑定且不是自己时生效（条件更新保证只绑一次） */
    async bindInviter(input: {
      userId: string
      inviterId: string
      inviteCodeId: string | null
      invitedAt: string
      operatorId: string | null
    }) {
      const result: unknown = await db
        .update(sysMember)
        .set({
          inviterId: input.inviterId,
          inviteCodeId: input.inviteCodeId,
          invitedAt: input.invitedAt,
          updatedBy: input.operatorId
        })
        .where(and(
          eq(sysMember.userId, input.userId),
          eq(sysMember.isDeleted, 0),
          sql`${sysMember.inviterId} is null`,
          sql`${sysMember.userId} <> ${input.inviterId}`
        ))

      return affectedRows(result)
    },

    /** 手工指定等级 */
    async changeLevel(input: {
      userId: string
      levelId: string
      changedAt: string
      remark: string | null
      operatorId: string | null
    }) {
      const result: unknown = await db
        .update(sysMember)
        .set({
          levelId: input.levelId,
          levelChangedAt: input.changedAt,
          levelRemark: input.remark,
          updatedBy: input.operatorId
        })
        .where(and(eq(sysMember.userId, input.userId), eq(sysMember.isDeleted, 0)))

      return affectedRows(result)
    },

    /** 我邀请的下级（单级） */
    async listInvitees(inviterId: string): Promise<MemberRow[]> {
      return await db
        .select()
        .from(sysMember)
        .where(and(eq(sysMember.inviterId, inviterId), eq(sysMember.isDeleted, 0)))
        .orderBy(desc(sysMember.createdAt))
    },

    /** 邀请码是否已被占用 */
    async existsInviteCode(inviteCode: string): Promise<boolean> {
      const rows = await db
        .select({ id: sysMember.id })
        .from(sysMember)
        .where(eq(sysMember.inviteCode, inviteCode))
        .limit(1)

      return Boolean(rows[0])
    },

    /** 读取会员相关的系统配置（注册赠金等），不需要 tRPC ctx */
    async readConfigValue(configKey: string): Promise<string | null> {
      const rows = await db
        .select({ configValue: sysConfig.configValue })
        .from(sysConfig)
        .where(and(
          eq(sysConfig.configKey, configKey),
          eq(sysConfig.status, 1),
          eq(sysConfig.isDeleted, 0)
        ))
        .limit(1)

      return rows[0]?.configValue ?? null
    },

    /** 会员列表筛选用：昵称/手机号等条件在 join 后由上层处理，这里只提供基础查询 */
    async listByKeyword(keyword: string, limit = 50): Promise<MemberRow[]> {
      return await db
        .select()
        .from(sysMember)
        .where(and(
          eq(sysMember.isDeleted, 0),
          like(sysMember.inviteCode, `%${keyword}%`)
        ))
        .limit(limit)
    }
  }
}

export type MemberRepo = ReturnType<typeof memberRepo>
