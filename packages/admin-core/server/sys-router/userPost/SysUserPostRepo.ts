import type { Context } from '#admin/server/trpc/context'
import { and, eq, inArray } from 'drizzle-orm'
import { sysUserPost } from '#admin/server/drizzle/schema'
import { randomUuid } from '#admin/shared/utils/uuid'

/**
 * 用户-岗位关联。
 *
 * 同步策略与 userRole 一致：已有关联做 enable/disable，新增的再 insert，
 * 不物理删除历史行，保留审计痕迹。
 */
export function sysUserPostRepo(ctx: Context) {
    return {
        async listByUserId(userId: string) {
            return await ctx.db
                .select({
                    id: sysUserPost.id,
                    postId: sysUserPost.postId,
                    isDeleted: sysUserPost.isDeleted,
                })
                .from(sysUserPost)
                .where(eq(sysUserPost.userId, userId))
        },

        async listByUserIds(userIds: string[]) {
            if (userIds.length === 0) {
                return []
            }

            return await ctx.db
                .select({
                    userId: sysUserPost.userId,
                    postId: sysUserPost.postId,
                })
                .from(sysUserPost)
                .where(and(
                    inArray(sysUserPost.userId, userIds),
                    eq(sysUserPost.status, 1),
                    eq(sysUserPost.isDeleted, 0)
                ))
        },

        async existsByPostId(postId: string) {
            const rows = await ctx.db
                .select({ id: sysUserPost.id })
                .from(sysUserPost)
                .where(and(
                    eq(sysUserPost.postId, postId),
                    eq(sysUserPost.status, 1),
                    eq(sysUserPost.isDeleted, 0)
                ))
                .limit(1)

            return Boolean(rows[0])
        },

        async replaceUserPosts(userId: string, postIds: string[], operatorId: string | null) {
            const selected = Array.from(new Set(postIds.filter(Boolean)))
            const selectedSet = new Set(selected)
            const existing = await ctx.db
                .select({
                    id: sysUserPost.id,
                    postId: sysUserPost.postId,
                    isDeleted: sysUserPost.isDeleted,
                })
                .from(sysUserPost)
                .where(eq(sysUserPost.userId, userId))

            const enableIds = existing
                .filter(row => selectedSet.has(row.postId))
                .map(row => row.id)
            const disableIds = existing
                .filter(row => row.isDeleted === 0 && !selectedSet.has(row.postId))
                .map(row => row.id)

            if (enableIds.length > 0) {
                await ctx.db
                    .update(sysUserPost)
                    .set({ status: 1, isDeleted: 0, updatedBy: operatorId })
                    .where(inArray(sysUserPost.id, enableIds))
            }

            if (disableIds.length > 0) {
                await ctx.db
                    .update(sysUserPost)
                    .set({ status: 0, isDeleted: 1, updatedBy: operatorId })
                    .where(inArray(sysUserPost.id, disableIds))
            }

            const insertPostIds = selected.filter(id => !existing.some(row => row.postId === id))
            if (insertPostIds.length > 0) {
                await ctx.db.insert(sysUserPost).values(insertPostIds.map(postId => ({
                    id: randomUuid(),
                    userId,
                    postId,
                    status: 1,
                    isDeleted: 0,
                    createdBy: operatorId,
                    updatedBy: operatorId,
                })))
            }
        },

        async removeByUserId(userId: string, operatorId: string | null) {
            await ctx.db
                .update(sysUserPost)
                .set({ status: 0, isDeleted: 1, updatedBy: operatorId })
                .where(and(
                    eq(sysUserPost.userId, userId),
                    eq(sysUserPost.isDeleted, 0)
                ))
        },
    }
}
