import { CommonRepo } from "#admin/server/drizzle/CommonRepo"
import type { Context } from "#admin/server/trpc/context"
import { SysUserRoleBaseSchema } from "#admin/shared/system/userRole/common"
import type { SysUserRoleAssignedIdsQueryDTO } from "#admin/shared/system/userRole"
import { randomUuid } from "#admin/shared/utils/uuid"
import { and, eq, inArray } from "drizzle-orm"
import { sysRole, sysUser, sysUserRole } from "#admin/server/drizzle/schema"

const commonRepo = CommonRepo(sysUserRole, SysUserRoleBaseSchema)

export const sysUserRoleRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    async listAssignedRoleIds(req: SysUserRoleAssignedIdsQueryDTO): Promise<string[]> {
      const rows = await ctx.db
        .select({ roleId: sysUserRole.roleId })
        .from(sysUserRole)
        .innerJoin(sysRole, eq(sysUserRole.roleId, sysRole.id))
        .where(and(
          eq(sysUserRole.userId, req.userId),
          eq(sysUserRole.status, 1),
          eq(sysUserRole.isDeleted, 0),
          eq(sysRole.status, 1),
          eq(sysRole.isDeleted, 0)
        ))

      return rows.map(row => row.roleId)
    },

    /**
     * Load all role relation rows for a user so the service can diff bindings locally.
     */
    async listByUserId(userId: string) {
      return await ctx.db
        .select({
          id: sysUserRole.id,
          roleId: sysUserRole.roleId,
          isDeleted: sysUserRole.isDeleted
        })
        .from(sysUserRole)
        .where(eq(sysUserRole.userId, userId))
    },

    /** 角色下所有用户关联行（分配用户弹窗用；包含已软删行以便复用） */
    async listByRoleId(roleId: string) {
      return await ctx.db
        .select({
          id: sysUserRole.id,
          userId: sysUserRole.userId,
          isDeleted: sysUserRole.isDeleted
        })
        .from(sysUserRole)
        .where(eq(sysUserRole.roleId, roleId))
    },

    /** 角色下仍可用的管理员 id（系统角色分配守卫用） */
    async listAssignedAdminIds(roleId: string) {
      const rows = await ctx.db
        .select({ userId: sysUserRole.userId })
        .from(sysUserRole)
        .innerJoin(sysUser, eq(sysUserRole.userId, sysUser.id))
        .where(and(
          eq(sysUserRole.roleId, roleId),
          eq(sysUserRole.status, 1),
          eq(sysUserRole.isDeleted, 0),
          eq(sysUser.isDeleted, 0),
          eq(sysUser.isAdmin, 1),
          eq(sysUser.status, 1)
        ))

      return rows.map(row => row.userId)
    },

    async listByUserIdAndRoleIds(userId: string, roleIds: string[]) {
      if (roleIds.length === 0) {
        return []
      }

      return await ctx.db
        .select({
          id: sysUserRole.id,
          roleId: sysUserRole.roleId
        })
        .from(sysUserRole)
        .where(and(
          eq(sysUserRole.userId, userId),
          inArray(sysUserRole.roleId, roleIds)
        ))
    },

    async enableByIds(ids: string[], operatorId: string | null) {
      if (ids.length === 0) {
        return
      }

      await ctx.db
        .update(sysUserRole)
        .set({
          status: 1,
          isDeleted: 0,
          updatedBy: operatorId
        })
        .where(inArray(sysUserRole.id, ids))
    },

    async disableByIds(ids: string[], operatorId: string | null) {
      if (ids.length === 0) {
        return
      }

      await ctx.db
        .update(sysUserRole)
        .set({
          status: 0,
          isDeleted: 1,
          updatedBy: operatorId
        })
        .where(inArray(sysUserRole.id, ids))
    },

    async createActiveAssignments(userId: string, roleIds: string[], operatorId: string | null) {
      if (roleIds.length === 0) {
        return
      }

      await ctx.db.insert(sysUserRole).values(roleIds.map(roleId => ({
        id: randomUuid(),
        userId,
        roleId,
        status: 1,
        isDeleted: 0,
        createdBy: operatorId,
        updatedBy: operatorId
      })))
    },

    /** 角色分配用户：批量建立 user-role 关联 */
    async createActiveAssignmentsForRole(roleId: string, userIds: string[], operatorId: string | null) {
      if (userIds.length === 0) {
        return
      }

      await ctx.db.insert(sysUserRole).values(userIds.map(userId => ({
        id: randomUuid(),
        userId,
        roleId,
        status: 1,
        isDeleted: 0,
        createdBy: operatorId,
        updatedBy: operatorId
      })))
    },

    /** 用户是否已关联该角色（未软删） */
    async existsLink(userId: string, roleId: string) {
      const rows = await ctx.db
        .select({ id: sysUserRole.id })
        .from(sysUserRole)
        .where(and(
          eq(sysUserRole.userId, userId),
          eq(sysUserRole.roleId, roleId),
          eq(sysUserRole.isDeleted, 0)
        ))
        .limit(1)

      return Boolean(rows[0])
    },

    /** 建立一条用户-角色关联（第三方首次登录分配默认角色用） */
    async createLink(userId: string, roleId: string, operatorId: string | null) {
      await ctx.db.insert(sysUserRole).values({
        id: randomUuid(),
        userId,
        roleId,
        status: 1,
        createdBy: operatorId,
        updatedBy: operatorId,
        isDeleted: 0
      })
    }
  }
}
