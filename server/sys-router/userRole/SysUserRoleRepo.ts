import { CommonRepo } from "#server/drizzle/CommonRepo"
import type { Context } from "#server/trpc/context"
import { SysUserRoleBaseSchema } from "#shared/system/userRole/common"
import type { SysUserRoleAssignedIdsQueryDTO } from "#shared/system/userRole"
import { randomUuid } from "#shared/utils/uuid"
import { and, eq, inArray } from "drizzle-orm"
import { sysRole, sysUserRole } from "~~/server/drizzle/schema"

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
          roleId: sysUserRole.roleId
        })
        .from(sysUserRole)
        .where(and(
          eq(sysUserRole.userId, userId),
          eq(sysUserRole.isDeleted, 0)
        ))
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
