import { CommonRepo } from '#admin/server/drizzle/CommonRepo'
import { SysRoleBaseSchema } from "#admin/shared/system/role/common";
import { sysRole, sysUser, sysUserRole } from "#admin/server/drizzle/schema";
import type { Context } from '#admin/server/trpc/context'
import { and, eq, inArray, like, or } from 'drizzle-orm'

const commonRepo = CommonRepo(sysRole, SysRoleBaseSchema)

export const sysRoleRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    /**
     * Load only the roles referenced by the current assignment request.
     */
    async listByIds(ids: string[]) {
      if (ids.length === 0) {
        return []
      }

      return await ctx.db
        .select()
        .from(sysRole)
        .where(and(
          eq(sysRole.isDeleted, 0),
          inArray(sysRole.id, ids)
        ))
    },

    /** 角色是否启用且未软删（分配默认角色前校验） */
    async findEnabledById(roleId: string) {
      const rows = await ctx.db
        .select({ id: sysRole.id })
        .from(sysRole)
        .where(and(
          eq(sysRole.id, roleId),
          eq(sysRole.status, 1),
          eq(sysRole.isDeleted, 0)
        ))
        .limit(1)

      return rows[0] ?? null
    },

    /**
     * 某用户已启用、已授权的角色（登录读模型用）。
     * 管理员特权由 auth 读模型处理，这里不伪造额外角色。
     */    async listEnabledByUserId(userId: string) {
      return await ctx.db
        .select({
          id: sysRole.id,
          name: sysRole.name,
          code: sysRole.code,
          dataScope: sysRole.dataScope
        })
        .from(sysUserRole)
        .innerJoin(sysRole, eq(sysUserRole.roleId, sysRole.id))
        .where(and(
          eq(sysUserRole.userId, userId),
          eq(sysUserRole.status, 1),
          eq(sysUserRole.isDeleted, 0),
          eq(sysRole.status, 1),
          eq(sysRole.isDeleted, 0)
        ))
    },

    /** 角色下已分配的用户（分配弹窗回显） */
    async listAssignedUsers(roleId: string) {
      return await ctx.db
        .select({
          id: sysUser.id,
          username: sysUser.username,
          nickname: sysUser.nickname,
        })
        .from(sysUserRole)
        .innerJoin(sysUser, eq(sysUserRole.userId, sysUser.id))
        .where(and(
          eq(sysUserRole.roleId, roleId),
          eq(sysUserRole.status, 1),
          eq(sysUserRole.isDeleted, 0),
          eq(sysUser.isDeleted, 0)
        ))
        .orderBy(sysUser.username)
    },

    /** 分配弹窗的可选用户（按用户名/昵称搜索，最多 limit 条） */
    async listAssignableUsers(keyword: string | undefined, limit: number) {
      const conditions = [
        eq(sysUser.isDeleted, 0),
        eq(sysUser.status, 1),
      ]

      if (keyword) {
        conditions.push(or(
          like(sysUser.username, `%${keyword}%`),
          like(sysUser.nickname, `%${keyword}%`)
        )!)
      }

      return await ctx.db
        .select({
          id: sysUser.id,
          username: sysUser.username,
          nickname: sysUser.nickname,
        })
        .from(sysUser)
        .where(and(...conditions))
        .orderBy(sysUser.username)
        .limit(limit)
    }
  }
}
