import { useLogger } from 'evlog'
import type { Context } from '#server/trpc/context'
import type { OrmPageResp } from '#server/utils/ApiResp'
import { AppError } from '#server/utils/appError'
import type { SysJobLogDto, SysJobLogPageQueryDTO } from '#shared/system/jobLog'
import { sysJobLogRepo } from './SysJobLogRepo'

export function sysJobLogService(ctx: Context) {
  const repo = sysJobLogRepo(ctx)
  // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
  const log = useLogger(ctx.event, 'server/sys-router/jobLog')

  return {
    async remove(id: string): Promise<boolean> {
      await repo.remove(id)
      log.info('jobLog removed', { jobLog: { action: 'remove', id } })
      return true
    },
    async batchRemove(ids: string[]): Promise<number> {
      await repo.batchRemove(ids)
      log.info('jobLog batch removed', { jobLog: { action: 'batchRemove', count: ids.length } })
      return ids.length
    },
    async getById(id: string): Promise<SysJobLogDto> {
      const pojo = await repo.getById(id)
      if (!pojo) throw new AppError('common.notExist')
      log.info('jobLog fetched', { jobLog: { action: 'getById', id } })
      return pojo
    },
    async page(req: SysJobLogPageQueryDTO): Promise<OrmPageResp> {
      const { page, pageSize, ...dto } = req
      const result = await repo.page(page, pageSize, dto)
      log.info('jobLog page queried', { jobLog: { action: 'page', page, pageSize, total: result.total } })
      return result
    }
  }
}
