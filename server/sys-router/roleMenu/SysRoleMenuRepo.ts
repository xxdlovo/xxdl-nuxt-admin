import { CommonRepo } from "#server/drizzle/CommonRepo";
import type { Context } from "#server/trpc/context";
import { SysRoleMenuBaseSchema } from "#shared/system/roleMenu/common";
import type { SysRoleMenuAssignedIdsQueryDTO } from "#shared/system/roleMenu";
import { randomUuid } from "#shared/utils/uuid";
import { and, eq, inArray } from "drizzle-orm";
import { sysMenu, sysRoleMenu } from "~~/server/drizzle/schema";

const commonRepo = CommonRepo(sysRoleMenu, SysRoleMenuBaseSchema)

export const sysRoleMenuRepo = (ctx: Context) => {
    const repo = commonRepo(ctx)

    return {
        ...repo,

        async listAssignedMenuIds(req: SysRoleMenuAssignedIdsQueryDTO): Promise<string[]> {
            const rows = await ctx.db
                .select({ menuId: sysRoleMenu.menuId })
                .from(sysRoleMenu)
                .innerJoin(sysMenu, eq(sysRoleMenu.menuId, sysMenu.id))
                .where(and(
                    eq(sysRoleMenu.roleId, req.roleId),
                    eq(sysRoleMenu.status, 1),
                    eq(sysRoleMenu.isDeleted, 0),
                    eq(sysMenu.isDeleted, 0),
                    inArray(sysMenu.type, req.types)
                ))

            return rows.map(row => row.menuId)
        },

        async listMenuIdsByTypes(types: Array<0 | 1 | 2>): Promise<string[]> {
            const rows = await ctx.db
                .select({ id: sysMenu.id })
                .from(sysMenu)
                .where(and(
                    eq(sysMenu.isDeleted, 0),
                    inArray(sysMenu.type, types)
                ))

            return rows.map(row => row.id)
        },

        async listByRoleIdAndMenuIds(roleId: string, menuIds: string[]): Promise<Array<{ id: string, menuId: string }>> {
            if (menuIds.length === 0) {
                return []
            }

            return await ctx.db
                .select({
                    id: sysRoleMenu.id,
                    menuId: sysRoleMenu.menuId,
                })
                .from(sysRoleMenu)
                .where(and(
                    eq(sysRoleMenu.roleId, roleId),
                    inArray(sysRoleMenu.menuId, menuIds)
                ))
        },

        async enableByIds(ids: string[], operatorId: string | null) {
            if (ids.length === 0) {
                return
            }

            await ctx.db
                .update(sysRoleMenu)
                .set({
                    status: 1,
                    isDeleted: 0,
                    updatedBy: operatorId
                })
                .where(inArray(sysRoleMenu.id, ids))
        },

        async disableByIds(ids: string[], operatorId: string | null) {
            if (ids.length === 0) {
                return
            }

            await ctx.db
                .update(sysRoleMenu)
                .set({
                    status: 0,
                    isDeleted: 1,
                    updatedBy: operatorId
                })
                .where(inArray(sysRoleMenu.id, ids))
        },

        async createActiveAssignments(roleId: string, menuIds: string[], operatorId: string | null) {
            if (menuIds.length === 0) {
                return
            }

            await ctx.db.insert(sysRoleMenu).values(menuIds.map(menuId => ({
                id: randomUuid(),
                roleId,
                menuId,
                status: 1,
                isDeleted: 0,
                createdBy: operatorId,
                updatedBy: operatorId
            })))
        }
    }
}
