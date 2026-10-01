import { desc, gte, lte, type SQL } from 'drizzle-orm'
import { CommonRepo } from '#server/drizzle/CommonRepo'
import { sysPayNotifyLog } from '~~/server/drizzle/schema'
import { SysPayNotifyLogBaseSchema } from '#shared/system/payNotifyLog/common'
import type { Context } from '#server/trpc/context'

const commonRepo = CommonRepo(sysPayNotifyLog, SysPayNotifyLogBaseSchema)

export type SysPayNotifyLogRangeQuery = {
  createdFrom?: string | null
  createdTo?: string | null
}

export const sysPayNotifyLogRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    /** 带时间区间的分页查询，默认按创建时间倒序（日志页只看最近发生的事） */
    async pageWithRange(
      page: number,
      pageSize: number,
      dto: Record<string, unknown>,
      range: SysPayNotifyLogRangeQuery = {}
    ) {
      const extraWhere: SQL[] = []

      if (range.createdFrom) {
        extraWhere.push(gte(sysPayNotifyLog.createdAt, range.createdFrom))
      }
      if (range.createdTo) {
        extraWhere.push(lte(sysPayNotifyLog.createdAt, range.createdTo))
      }

      return await repo.page(page, pageSize, dto, [desc(sysPayNotifyLog.createdAt)], extraWhere)
    }
  }
}
