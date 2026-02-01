import { eq, SQL } from "drizzle-orm"
import type { Context } from '#server/trpc/context';
/** 自动注入逻辑删除 + RBAC */
export function buildScope(table: any, ctx: Context): SQL[] {
    const conditions: SQL[] = []
    // 逻辑删除
    conditions.push(eq(table.isDeleted, 0))
    return conditions
}
