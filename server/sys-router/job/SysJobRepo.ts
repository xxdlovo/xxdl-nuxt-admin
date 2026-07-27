import { and, desc, eq, lte } from 'drizzle-orm'
import { CommonRepo } from '#server/drizzle/CommonRepo'
import { SysJobBaseSchema } from '#shared/system/job/common'
import { sysJob } from '~~/server/drizzle/schema'
import type { Context } from '#server/trpc/context'
import { formatMysqlDate } from './cron'

const commonRepo = CommonRepo(sysJob, SysJobBaseSchema)

export const sysJobRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    async page(page: number, pageSize: number, dto: any) {
      return repo.page(page, pageSize, dto, [desc(sysJob.createdAt)])
    },

    async listDueJobs(now = formatMysqlDate()) {
      return ctx.db
        .select()
        .from(sysJob)
        .where(and(
          eq(sysJob.isDeleted, 0),
          eq(sysJob.status, 1),
          eq(sysJob.runningStatus, 0),
          lte(sysJob.nextRunAt, now)
        ))
        .orderBy(sysJob.nextRunAt)
    }
  }
}
