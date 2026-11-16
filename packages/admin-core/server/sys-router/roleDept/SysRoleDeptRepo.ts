import type { Context } from '#admin/server/trpc/context'
import { and, eq, inArray } from 'drizzle-orm'
import { sysRoleDept, sysRole, sysUserRole } from '#admin/server/drizzle/schema'
import { randomUuid } from '#admin/shared/utils/uuid'

/**
 * 角色-自定义数据权限部门。
 *
 * 软删除 + 唯一键的组合要求同步时查询“包含已删除”的行：
 * 之前删过、这次又重新勾选的部门要复用原行，否则唯一键会冲突。
 */
export function sysRoleDeptRepo(ctx: Context) {
    return {
        async listByRoleId(roleId: string) {
            const rows = await ctx.db
                .select({ deptId: sysRoleDept.deptId })
                .from(sysRoleDept)
                .where(and(
                    eq(sysRoleDept.roleId, roleId),
                    eq(sysRoleDept.status, 1),
                    eq(sysRoleDept.isDeleted, 0)
                ))

            return rows.map(row => row.deptId)
        },

        /** 当前用户所有启用角色授权的部门（data_scope=2 用） */
        async listDeptIdsByUserId(userId: string) {
            const rows = await ctx.db
                .selectDistinct({ deptId: sysRoleDept.deptId })
                .from(sysUserRole)
                .innerJoin(sysRole, eq(sysUserRole.roleId, sysRole.id))
                .innerJoin(sysRoleDept, eq(sysRoleDept.roleId, sysRole.id))
                .where(and(
                    eq(sysUserRole.userId, userId),
                    eq(sysUserRole.status, 1),
                    eq(sysUserRole.isDeleted, 0),
                    eq(sysRole.status, 1),
                    eq(sysRole.isDeleted, 0),
                    eq(sysRoleDept.status, 1),
                    eq(sysRoleDept.isDeleted, 0)
                ))

            return rows.map(row => row.deptId)
        },

        async replaceByRoleId(roleId: string, deptIds: string[], operatorId: string | null) {
            const selected = Array.from(new Set(deptIds.filter(Boolean)))
            const selectedSet = new Set(selected)

            const existing = await ctx.db
                .select({
                    id: sysRoleDept.id,
                    deptId: sysRoleDept.deptId,
                    isDeleted: sysRoleDept.isDeleted,
                })
                .from(sysRoleDept)
                .where(eq(sysRoleDept.roleId, roleId))

            const enableIds = existing
                .filter(row => selectedSet.has(row.deptId))
                .map(row => row.id)
            const disableIds = existing
                .filter(row => row.isDeleted === 0 && !selectedSet.has(row.deptId))
                .map(row => row.id)

            if (enableIds.length > 0) {
                await ctx.db
                    .update(sysRoleDept)
                    .set({ status: 1, isDeleted: 0, updatedBy: operatorId })
                    .where(inArray(sysRoleDept.id, enableIds))
            }

            if (disableIds.length > 0) {
                await ctx.db
                    .update(sysRoleDept)
                    .set({ status: 0, isDeleted: 1, updatedBy: operatorId })
                    .where(inArray(sysRoleDept.id, disableIds))
            }

            const insertDeptIds = selected.filter(id => !existing.some(row => row.deptId === id))

            if (insertDeptIds.length > 0) {
                await ctx.db.insert(sysRoleDept).values(insertDeptIds.map(deptId => ({
                    id: randomUuid(),
                    roleId,
                    deptId,
                    status: 1,
                    isDeleted: 0,
                    createdBy: operatorId,
                    updatedBy: operatorId,
                })))
            }
        },

        async removeByRoleId(roleId: string, operatorId: string | null) {
            await ctx.db
                .update(sysRoleDept)
                .set({ status: 0, isDeleted: 1, updatedBy: operatorId })
                .where(and(
                    eq(sysRoleDept.roleId, roleId),
                    eq(sysRoleDept.isDeleted, 0)
                ))
        },
    }
}
