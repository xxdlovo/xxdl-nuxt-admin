import { CommonRepo } from "#server/drizzle/CommonRepo";
import type { Context } from "#server/trpc/context";
import {SysMenuBaseSchema, type SysMenuDto} from "#shared/system/menu/common";
import { asc, sql } from "drizzle-orm";
import { sysMenu } from "~~/server/drizzle/schema";

const commonRepo = CommonRepo(sysMenu, SysMenuBaseSchema)

export const sysMenuRepo = (ctx: Context) => {
    const repo = commonRepo(ctx)

    return {
        ...repo,
        async listSort(dto: any = {}): Promise<SysMenuDto[]> {
            return await repo.list(dto, [asc(sysMenu.sortOrder)])
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
