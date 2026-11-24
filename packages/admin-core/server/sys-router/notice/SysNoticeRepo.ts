import { CommonRepo } from '#admin/server/drizzle/CommonRepo'
import { SysNoticeBaseSchema } from '#admin/shared/system/notice/common'
import { sysNotice } from '#admin/server/drizzle/schema'
import type { Context } from '#admin/server/trpc/context'
import { and, count, desc, eq, isNull, lte, or } from 'drizzle-orm'

function nowForMysql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

const commonRepo = CommonRepo(sysNotice, SysNoticeBaseSchema)

export const sysNoticeRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    async listPublished(limit = 10) {
      const now = nowForMysql()
      return await ctx.db
        .select()
        .from(sysNotice)
        .where(and(
          eq(sysNotice.isDeleted, 0),
          eq(sysNotice.publishStatus, 1),
          or(
            lte(sysNotice.publishTime, now),
            isNull(sysNotice.publishTime)
          )
        ))
        .orderBy(desc(sysNotice.topFlag), desc(sysNotice.sortOrder), desc(sysNotice.publishTime), desc(sysNotice.createdAt))
        .limit(limit)
    },

    /**
     * 公开公告分页：无需登录，只返回「已发布且发布时间已到」的公告。
     *
     * 这里手写查询而不是复用 CommonRepo.page：
     * 公开接口没有登录用户，不应参与数据权限推导，条件必须完全可控。
     * 排序按 publishTime 倒序（置顶/排序号不参与），符合「最新发布在前」的语义。
     */
    async publicPage(page = 1, pageSize = 10) {
      const now = nowForMysql()
      const where = and(
        eq(sysNotice.isDeleted, 0),
        eq(sysNotice.publishStatus, 1),
        or(
          lte(sysNotice.publishTime, now),
          isNull(sysNotice.publishTime)
        )
      )

      const totalResult = await ctx.db
        .select({ total: count() })
        .from(sysNotice)
        .where(where)

      const list = await ctx.db
        .select()
        .from(sysNotice)
        .where(where)
        .orderBy(desc(sysNotice.publishTime), desc(sysNotice.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize)

      return {
        total: totalResult[0]?.total ?? 0,
        page,
        pageSize,
        list
      }
    },

    /** 管理端按发布时间倒序分页（含未发布，受调用方权限控制）。 */
    async pageByPublishTime(page: number, pageSize: number, dto: any = {}) {
      return repo.page(page, pageSize, dto, [
        desc(sysNotice.publishTime),
        desc(sysNotice.createdAt)
      ])
    }
  }
}
