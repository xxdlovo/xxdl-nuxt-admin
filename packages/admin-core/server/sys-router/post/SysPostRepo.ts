import { CommonRepo } from '#admin/server/drizzle/CommonRepo'
import type { Context } from '#admin/server/trpc/context'
import { SysPostBaseSchema } from '#admin/shared/system/post'
import { sysPost } from '#admin/server/drizzle/schema'
import { and, eq, inArray, ne } from 'drizzle-orm'

const commonRepo = CommonRepo(sysPost, SysPostBaseSchema)

export const sysPostRepo = (ctx: Context) => {
    const repo = commonRepo(ctx)

    return {
        ...repo,

        async listEnabled() {
            return await ctx.db
                .select()
                .from(sysPost)
                .where(and(
                    eq(sysPost.status, 1),
                    eq(sysPost.isDeleted, 0)
                ))
                .orderBy(sysPost.sortOrder)
        },

        async listByIds(ids: string[]) {
            if (ids.length === 0) {
                return []
            }

            return await ctx.db
                .select()
                .from(sysPost)
                .where(and(
                    inArray(sysPost.id, ids),
                    eq(sysPost.isDeleted, 0)
                ))
        },

        async existsCode(code: string, excludeId?: string | null) {
            const conditions = [
                eq(sysPost.code, code),
                eq(sysPost.isDeleted, 0),
            ]

            if (excludeId) {
                conditions.push(ne(sysPost.id, excludeId))
            }

            const rows = await ctx.db
                .select({ id: sysPost.id })
                .from(sysPost)
                .where(and(...conditions))
                .limit(1)

            return Boolean(rows[0])
        },
    }
}
