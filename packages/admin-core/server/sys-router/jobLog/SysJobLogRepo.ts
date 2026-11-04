import { desc } from 'drizzle-orm'
import { CommonRepo } from '#admin/server/drizzle/CommonRepo'
import { SysJobLogBaseSchema } from '#admin/shared/system/jobLog/common'
import { sysJobLog } from '#admin/server/drizzle/schema'
import type { Context } from '#admin/server/trpc/context'

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
