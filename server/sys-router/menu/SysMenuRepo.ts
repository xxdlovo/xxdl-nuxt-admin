import { CommonRepo } from "#server/drizzle/CommonRepo";
import type { Context } from "#server/trpc/context";
import {SysMenuBaseSchema, type SysMenuDto} from "#shared/system/menu/common";
import { and, asc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { sysMenu, sysRoleMenu } from "~~/server/drizzle/schema";

const commonRepo = CommonRepo(sysMenu, SysMenuBaseSchema)

/** 菜单行类型：Service 侧不再直接依赖 drizzle schema */
export type SysMenuRow = typeof sysMenu.$inferSelect

/** 启用中且未软删的菜单/权限行 */
function enabledPermissionWhere(): SQL {
    return and(eq(sysMenu.status, 1), eq(sysMenu.isDeleted, 0)) as SQL
}

export const sysMenuRepo = (ctx: Context) => {
    const repo = commonRepo(ctx)

    return {
        ...repo,
        async listSort(dto: any = {}): Promise<SysMenuDto[]> {
            return await repo.list(dto, [asc(sysMenu.sortOrder)])
        },

        /**
         * 按父级分页：parentId === '0' 表示查根节点（库里 '0' / '' / NULL 三种写法并存），
         * 指定其他 parentId 则查该父级下的直接子节点。
         */
        async pageByParent(page: number, pageSize: number, dto: Record<string, unknown>, parentId?: string | null) {
            const extraWhere: SQL[] = []

            if (parentId === '0') {
                const rootParentWhere = or(eq(sysMenu.parentId, '0'), isNull(sysMenu.parentId))

                if (rootParentWhere) {
                    extraWhere.push(rootParentWhere)
                }
            } else if (parentId) {
                extraWhere.push(eq(sysMenu.parentId, parentId))
            }

            return await repo.page(page, pageSize, dto, [asc(sysMenu.sortOrder)], extraWhere)
        },

        /** 管理员视角：全部启用中的菜单/权限行 */
        async listEnabledRows() {
            return await ctx.db
                .select()
                .from(sysMenu)
                .where(enabledPermissionWhere())
        },

        /** 指定角色已授权的启用菜单/权限行（扁平，供 RBAC 读模型使用） */
        async listEnabledRowsByRoleIds(roleIds: string[]) {
            if (roleIds.length === 0) {
                return []
            }

            return await ctx.db
                .select({
                    id: sysMenu.id,
                    parentId: sysMenu.parentId,
                    name: sysMenu.name,
                    code: sysMenu.code,
                    type: sysMenu.type,
                    path: sysMenu.path,
                    component: sysMenu.component,
                    icon: sysMenu.icon,
                    sortOrder: sysMenu.sortOrder,
                    visible: sysMenu.visible,
                    status: sysMenu.status,
                    remark: sysMenu.remark,
                    createdBy: sysMenu.createdBy,
                    createdAt: sysMenu.createdAt,
                    updatedBy: sysMenu.updatedBy,
                    updatedAt: sysMenu.updatedAt,
                    isDeleted: sysMenu.isDeleted
                })
                .from(sysRoleMenu)
                .innerJoin(sysMenu, eq(sysRoleMenu.menuId, sysMenu.id))
                .where(and(
                    inArray(sysRoleMenu.roleId, roleIds),
                    eq(sysRoleMenu.status, 1),
                    eq(sysRoleMenu.isDeleted, 0),
                    enabledPermissionWhere()
                ))
        },

        async listSelfAndDescendantIds(ids: string[]): Promise<string[]> {
            const rootIds = Array.from(new Set(ids.filter(Boolean)))

            if (rootIds.length === 0) {
                return []
            }

            // Resolve the menu subtree in MySQL instead of loading all sys_menu rows into application memory.
            const result = await ctx.db.execute(sql`
                WITH RECURSIVE menu_tree AS (
                    SELECT id
                    FROM sys_menu
                    WHERE is_deleted = 0
                      AND id IN (${sql.join(rootIds.map(id => sql`${id}`), sql`, `)})
                    UNION
                    SELECT m.id
                    FROM sys_menu m
                    INNER JOIN menu_tree mt ON m.parent_id = mt.id
                    WHERE m.is_deleted = 0
                )
                SELECT id FROM menu_tree
            `)

            const rows = Array.isArray(result) && Array.isArray(result[0])
                ? result[0]
                : result

            return (rows as Array<{ id: string }>).map(row => row.id)
        }
    }
}
