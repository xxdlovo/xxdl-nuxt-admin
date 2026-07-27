import { desc } from 'drizzle-orm'
import { CommonRepo } from '#server/drizzle/CommonRepo'
import { SysJobLogBaseSchema } from '#shared/system/jobLog/common'
import { sysJobLog } from '~~/server/drizzle/schema'
import type { Context } from '#server/trpc/context'

const commonRepo = CommonRepo(sysJobLog, SysJobLogBaseSchema)

export const sysJobLogRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    async page(page: number, pageSize: number, dto: any) {
      return repo.page(page, pageSize, dto, [desc(sysJobLog.startedAt)])
    }
  }
}
