//#server/trade-router/modules/memberBalanceLog
/**
 * 余额流水 mapper（模块层，ctx 版）。
 *
 * 复用域内 mapper（`domain/wallet/repo/balanceLogRepo.ts`）做条件组装，
 * 但列表查询走 `CommonRepo.page`，这样**数据权限**（`buildScopedWhere`）与其它模块保持一致。
 */
import { desc, gte, lte, type SQL } from 'drizzle-orm'
import { CommonRepo } from '#server/drizzle/CommonRepo'
import { sysMemberBalanceLog } from '~~/server/drizzle/schema'
import { SysMemberBalanceLogBaseSchema } from '#shared/system/memberBalanceLog/common'
import { balanceLogRepo } from '#server/trade-router/domain/wallet/repo/balanceLogRepo'
import type { Context } from '#server/trpc/context'

const commonRepo = CommonRepo(sysMemberBalanceLog, SysMemberBalanceLogBaseSchema)

export type SysMemberBalanceLogRange = {
  createdFrom?: string | null
  createdTo?: string | null
}

export const sysMemberBalanceLogRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)
  const logs = balanceLogRepo(ctx.db)

  return {
    ...repo,

    /** 分页查询：表字段由 CommonRepo 处理，时间区间用 extraWhere 追加（与 payOrder 同做法） */
    async pageWithRange(
      page: number,
      pageSize: number,
      dto: Record<string, unknown>,
      range: SysMemberBalanceLogRange = {}
    ) {
      const extraWhere: SQL[] = []

      if (range.createdFrom) {
        extraWhere.push(gte(sysMemberBalanceLog.createdAt, range.createdFrom))
      }
      if (range.createdTo) {
        extraWhere.push(lte(sysMemberBalanceLog.createdAt, range.createdTo))
      }

      return await repo.page(page, pageSize, dto, [desc(sysMemberBalanceLog.createdAt)], extraWhere)
    },

    /** 导出用：同样带数据权限，仅仅是放大 limit */
    async listWithRange(
      dto: Record<string, unknown>,
      range: SysMemberBalanceLogRange = {},
      limit = 5000
    ) {
      const extraWhere: SQL[] = []

      if (range.createdFrom) {
        extraWhere.push(gte(sysMemberBalanceLog.createdAt, range.createdFrom))
      }
      if (range.createdTo) {
        extraWhere.push(lte(sysMemberBalanceLog.createdAt, range.createdTo))
      }

      const result = await repo.page(1, limit, dto, [desc(sysMemberBalanceLog.createdAt)], extraWhere)

      return result.list
    },

    /** 按业务类型汇总区间发生额（对账页看板） */
    sumByBizType(range: SysMemberBalanceLogRange = {}) {
      return logs.sumByBizType(range)
    },

    /** 全部用户的流水净额（分组一次查询，用于一致性校验） */
    sumNetGroupByUser() {
      return logs.sumNetGroupByUser()
    }
  }
}

export type SysMemberBalanceLogRepo = ReturnType<typeof sysMemberBalanceLogRepo>
