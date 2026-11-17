import { and, count, desc, eq, gt, inArray, isNull, like, ne, or, sql } from 'drizzle-orm'
import type { Context } from '#admin/server/trpc/context'
import { sysUserSession } from '#admin/server/drizzle/schema'
import type { SysOnlinePageQueryDTO } from '#admin/shared/system/online'

/**
 * 在线会话数据访问。
 *
 * 只返回管理端需要的列，避免把 user_agent 这类长文本带到列表里。
 */
export function sysUserSessionRepo(ctx: Context) {
    const db = ctx.db

    return {
        async create(data: typeof sysUserSession.$inferInsert) {
            await db.insert(sysUserSession).values(data)
        },

        async page(page: number, pageSize: number, filter: Pick<SysOnlinePageQueryDTO, 'username' | 'ip'>) {
            const conditions = [
                isNull(sysUserSession.revokedAt),
                or(
                    isNull(sysUserSession.expiresAt),
                    gt(sysUserSession.expiresAt, sql`CURRENT_TIMESTAMP`)
                )
            ]

            if (filter.username) {
                conditions.push(like(sysUserSession.username, `%${filter.username}%`))
            }
            if (filter.ip) {
                conditions.push(like(sysUserSession.ip, `%${filter.ip}%`))
            }

            const where = and(...conditions)
            const offset = (page - 1) * pageSize

            const totalRows = await db
                .select({ total: count() })
                .from(sysUserSession)
                .where(where)

            const list = await db
                .select({
                    id: sysUserSession.id,
                    userId: sysUserSession.userId,
                    username: sysUserSession.username,
                    ip: sysUserSession.ip,
                    browser: sysUserSession.browser,
                    os: sysUserSession.os,
                    loginAt: sysUserSession.loginAt,
                    lastSeenAt: sysUserSession.lastSeenAt,
                    expiresAt: sysUserSession.expiresAt,
                })
                .from(sysUserSession)
                .where(where)
                .orderBy(desc(sysUserSession.lastSeenAt), desc(sysUserSession.loginAt))
                .limit(pageSize)
                .offset(offset)

            return {
                total: totalRows[0]?.total ?? 0,
                page,
                pageSize,
                list,
            }
        },

        async getById(id: string) {
            const rows = await db
                .select({ id: sysUserSession.id, userId: sysUserSession.userId })
                .from(sysUserSession)
                .where(eq(sysUserSession.id, id))
                .limit(1)

            return rows[0] ?? null
        },

        async revoke(id: string, revokedBy?: string | null) {
            await db
                .update(sysUserSession)
                .set({
                    revokedAt: sql`CURRENT_TIMESTAMP`,
                    revokedBy: revokedBy ?? null,
                })
                .where(and(
                    eq(sysUserSession.id, id),
                    isNull(sysUserSession.revokedAt)
                ))
        },

        async revokeBatch(ids: string[], revokedBy?: string | null) {
            if (ids.length === 0) {
                return 0
            }

            await db
                .update(sysUserSession)
                .set({
                    revokedAt: sql`CURRENT_TIMESTAMP`,
                    revokedBy: revokedBy ?? null,
                })
                .where(and(
                    inArray(sysUserSession.id, ids),
                    isNull(sysUserSession.revokedAt)
                ))

            return ids.length
        },

        /** 禁用/删除用户时撤销其全部会话；本人改密时可用 exceptSessionId 保留当前会话。 */
        async revokeByUserId(
            userId: string,
            revokedBy?: string | null,
            exceptSessionId?: string | null,
        ) {
            const conditions = [
                eq(sysUserSession.userId, userId),
                isNull(sysUserSession.revokedAt),
            ]

            if (exceptSessionId) {
                conditions.push(ne(sysUserSession.id, exceptSessionId))
            }

            const rows = await db
                .select({ id: sysUserSession.id })
                .from(sysUserSession)
                .where(and(...conditions))

            if (rows.length === 0) {
                return [] as string[]
            }

            await db
                .update(sysUserSession)
                .set({
                    revokedAt: sql`CURRENT_TIMESTAMP`,
                    revokedBy: revokedBy ?? null,
                })
                .where(and(...conditions))

            return rows.map(row => row.id)
        },
    }
}
