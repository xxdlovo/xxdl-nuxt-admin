import { CommonRepo } from '#server/drizzle/CommonRepo'
import { SysNoticeBaseSchema } from '#shared/system/notice/common'
import { sysNotice } from '~~/server/drizzle/schema'
import type { Context } from '#server/trpc/context'
import { and, desc, eq, isNull, lte, or } from 'drizzle-orm'

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
    }
  }
}
