import { CommonRepo } from "#admin/server/drizzle/CommonRepo"
import type { Context } from "#admin/server/trpc/context"
import { SysUserBaseSchema } from "#admin/shared/system/user/common"
import { and, count, eq, getTableColumns, inArray, notInArray, sql } from "drizzle-orm"
import { sysDepartment, sysUser } from "#admin/server/drizzle/schema"
import { buildScopedWhere } from "#admin/server/drizzle/queries/buildScope"
import { buildWhereBySchema } from "#admin/server/drizzle/queries/buildWhereBySchema"

const commonRepo = CommonRepo(sysUser, SysUserBaseSchema)
const userColumns = getTableColumns(sysUser)
const userWithDeptColumns = {
  ...userColumns,
  deptName: sysDepartment.name,
  deptCode: sysDepartment.code
}

export const sysUserRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    async pageWithDept(page: number, pageSize: number, dto: any) {
      const offset = (page - 1) * pageSize
      const dynamicWhere = buildWhereBySchema(SysUserBaseSchema, sysUser, dto)
      const where = await buildScopedWhere(sysUser, ctx, ...dynamicWhere)

      const totalResult = await ctx.db
        .select({ total: count() })
        .from(sysUser)
        .where(where)

      const data = await ctx.db
        .select(userWithDeptColumns)
        .from(sysUser)
        .leftJoin(sysDepartment, and(
          eq(sysUser.deptId, sysDepartment.id),
          eq(sysDepartment.isDeleted, 0)
        ))
        .where(where)
        .limit(pageSize)
        .offset(offset)

      return {
        total: totalResult[0]?.total ?? 0,
        page,
        pageSize,
        list: data
      }
    },

    async listWithDept(dto: any = {}) {
      const dynamicWhere = buildWhereBySchema(SysUserBaseSchema, sysUser, dto)
      const where = await buildScopedWhere(sysUser, ctx, ...dynamicWhere)

      return ctx.db
        .select(userWithDeptColumns)
        .from(sysUser)
        .leftJoin(sysDepartment, and(
          eq(sysUser.deptId, sysDepartment.id),
          eq(sysDepartment.isDeleted, 0)
        ))
        .where(where)
    },

    async getOneWithDept(req: any) {
      const dynamicWhere = buildWhereBySchema(SysUserBaseSchema, sysUser, req)
      const where = await buildScopedWhere(sysUser, ctx, ...dynamicWhere)
      const data = await ctx.db
        .select(userWithDeptColumns)
        .from(sysUser)
        .leftJoin(sysDepartment, and(
          eq(sysUser.deptId, sysDepartment.id),
          eq(sysDepartment.isDeleted, 0)
        ))
        .where(where)
        .limit(1)

      return data[0] ?? null
    },

    async getByIdWithDept(id: string) {
      const data = await ctx.db
        .select(userWithDeptColumns)
        .from(sysUser)
        .leftJoin(sysDepartment, and(
          eq(sysUser.deptId, sysDepartment.id),
          eq(sysDepartment.isDeleted, 0)
        ))
        .where(await buildScopedWhere(sysUser, ctx, eq(sysUser.id, id)))
        .limit(1)

      return data[0] ?? null
    },

    async updatePasswordById(id: string, password: string) {
      await ctx.db
        .update(sysUser)
        .set({ password })
        .where(eq(sysUser.id, id))
    },

    /** 按 id 取未软删用户（第三方登录绑定流程用，不走数据权限过滤） */
    async getActiveById(id: string) {
      const rows = await ctx.db
        .select()
        .from(sysUser)
        .where(and(eq(sysUser.id, id), eq(sysUser.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    /**
     * 按 id 批量取当前数据权限内的用户。
     *
     * 删除/禁用前的管理员守卫必须只针对“本次真的会被删除”的用户，
     * 否则会把数据权限外的用户也算进来，导致误拦截。
     */
    async listScopedByIds(ids: string[]) {
      if (ids.length === 0) {
        return []
      }

      return ctx.db
        .select({
          id: sysUser.id,
          username: sysUser.username,
          isAdmin: sysUser.isAdmin,
          status: sysUser.status,
        })
        .from(sysUser)
        .where(await buildScopedWhere(sysUser, ctx, inArray(sysUser.id, ids)))
    },

    /**
     * 统计全系统仍可用的管理员数量。
     *
     * 不叠加数据权限：判断“删掉后还有没有人能管理后台”必须看全局，
     * 不能因为当前操作者的数据范围而少算。
     */
    async countActiveAdmins(excludeIds: string[] = []) {
      const conditions = [
        eq(sysUser.isDeleted, 0),
        eq(sysUser.isAdmin, 1),
        eq(sysUser.status, 1),
      ]

      if (excludeIds.length > 0) {
        conditions.push(notInArray(sysUser.id, excludeIds))
      }

      const rows = await ctx.db
        .select({ total: count() })
        .from(sysUser)
        .where(and(...conditions))

      return Number(rows[0]?.total ?? 0)
    },

    /** 按邮箱取未软删用户（邮箱在库中唯一） */
    async getActiveByEmail(email: string) {
      const rows = await ctx.db
        .select()
        .from(sysUser)
        .where(and(eq(sysUser.email, email), eq(sysUser.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    /** 用户名是否已被占用 */
    async existsUsername(username: string) {
      const rows = await ctx.db
        .select({ id: sysUser.id })
        .from(sysUser)
        .where(eq(sysUser.username, username))
        .limit(1)

      return Boolean(rows[0])
    },

    /** 新建用户（第三方首次登录建号用：密码写入占位标记） */
    async createUser(values: typeof sysUser.$inferInsert) {
      return await ctx.db.insert(sysUser).values(values)
    },

    /** 用户名是否已存在（注册查重） */
    async existsByUsername(username: string) {
      const rows = await ctx.db
        .select({ id: sysUser.id })
        .from(sysUser)
        .where(eq(sysUser.username, username))
        .limit(1)

      return Boolean(rows[0])
    },

    /** 手机号是否已存在（注册查重） */
    async existsByPhone(phone: string) {
      const rows = await ctx.db
        .select({ id: sysUser.id })
        .from(sysUser)
        .where(eq(sysUser.phone, phone))
        .limit(1)

      return Boolean(rows[0])
    },

    /** 邮箱是否已存在（导入查重） */
    async existsByEmail(email: string) {
      const rows = await ctx.db
        .select({ id: sysUser.id })
        .from(sysUser)
        .where(and(eq(sysUser.email, email), eq(sysUser.isDeleted, 0)))
        .limit(1)

      return Boolean(rows[0])
    },

    /** 只取所属部门 id（保存后回读校验用） */
    async getDeptIdById(id: string) {
      const rows = await ctx.db
        .select({ deptId: sysUser.deptId })
        .from(sysUser)
        .where(and(eq(sysUser.id, id), eq(sysUser.isDeleted, 0)))
        .limit(1)

      return rows[0]?.deptId ?? null
    },

    /** 只取密码列（判断是否已设置过真实密码，避免把哈希暴露给调用方） */
    async getPasswordById(id: string) {
      const rows = await ctx.db
        .select({ password: sysUser.password })
        .from(sysUser)
        .where(and(eq(sysUser.id, id), eq(sysUser.isDeleted, 0)))
        .limit(1)

      return rows[0]?.password ?? null
    },

    /** 登录用：按用户名取未软删用户（含密码，仅登录流程使用） */
    async getLoginUserByUsername(username: string) {
      const rows = await ctx.db
        .select()
        .from(sysUser)
        .where(and(eq(sysUser.username, username), eq(sysUser.isDeleted, 0)))
        .limit(1)

      return rows[0] ?? null
    },

    /** 连续登录失败 +1，返回最新失败次数 */
    async incrementLoginFail(id: string) {
      await ctx.db
        .update(sysUser)
        .set({ loginFailCount: sql`${sysUser.loginFailCount} + 1` })
        .where(eq(sysUser.id, id))

      const rows = await ctx.db
        .select({ loginFailCount: sysUser.loginFailCount })
        .from(sysUser)
        .where(eq(sysUser.id, id))
        .limit(1)

      return rows[0]?.loginFailCount ?? 0
    },

    /** 锁定账号到 minutes 分钟后 */
    async lockLogin(id: string, minutes: number) {
      await ctx.db
        .update(sysUser)
        .set({
          lockedUntil: sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ${minutes} MINUTE)`,
        })
        .where(eq(sysUser.id, id))
    },

    /** 清空失败次数与锁定时间（解锁 / 登录成功 / 密码重置） */
    async clearLoginFailure(id: string) {
      await ctx.db
        .update(sysUser)
        .set({ loginFailCount: 0, lockedUntil: null })
        .where(eq(sysUser.id, id))
    },

    /** 登录成功：更新最后登录信息并清空锁定状态 */
    async markLoginSuccess(id: string, ip: string) {
      await ctx.db
        .update(sysUser)
        .set({
          lastLoginTime: sql`CURRENT_TIMESTAMP`,
          lastLoginIp: ip,
          loginFailCount: 0,
          lockedUntil: null,
        })
        .where(eq(sysUser.id, id))
    }
  }
}
