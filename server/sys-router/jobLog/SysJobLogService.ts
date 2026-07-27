import type { Context } from '#server/trpc/context'
import type { OrmPageResp } from '#server/utils/ApiResp'
import { AppError } from '#server/utils/appError'
import type { SysJobLogDto, SysJobLogPageQueryDTO } from '#shared/system/jobLog'
import { sysJobLogRepo } from './SysJobLogRepo'

export function sysJobLogService(ctx: Context) {
  const repo = sysJobLogRepo(ctx)

  return {
    async remove(id: string): Promise<boolean> {
      await repo.remove(id)
      return true
    },
    async batchRemove(ids: string[]): Promise<number> {
      await repo.batchRemove(ids)
      return ids.length
    },
    async getById(id: string): Promise<SysJobLogDto> {
      const pojo = await repo.getById(id)
      if (!pojo) throw new AppError('common.notExist')
      return pojo
    },
    async page(req: SysJobLogPageQueryDTO): Promise<OrmPageResp> {
      const { page, pageSize, ...dto } = req
      return repo.page(page, pageSize, dto)
    }
  }
}
