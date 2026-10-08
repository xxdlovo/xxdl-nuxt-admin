import { useLogger } from 'evlog'
import type { SysConfigAddDTO, SysConfigDto, SysConfigPageQueryDTO, SysConfigQueryDTO, SysConfigUpdateDTO } from '#shared/system/config'
import { randomUuid } from '#shared/utils/uuid'
import type { Context } from '#server/trpc/context'
import type { OrmPageResp } from '#server/utils/ApiResp'
import { AppError } from '#server/utils/appError'
import { sysConfigRepo } from './SysConfigRepo'

export function sysConfigService(ctx: Context) {
  const repo = sysConfigRepo(ctx)
  // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
  const log = useLogger(ctx.event, 'server/sys-router/config')

  return {
    async create(data: SysConfigAddDTO): Promise<boolean> {
      const uuid = randomUuid()
      await repo.create({ ...data, id: uuid })
      log.info('config created', { config: { action: 'create', id: uuid } })
      return true
    },
    async remove(id: string): Promise<boolean> {
      await repo.remove(id)
      log.info('config removed', { config: { action: 'remove', id } })
      return true
    },
    async batchRemove(ids: string[]): Promise<number> {
      await repo.batchRemove(ids)
      log.info('config batch removed', { config: { action: 'batchRemove', count: ids.length } })
      return ids.length
    },
    async updateById(id: string, data: SysConfigUpdateDTO): Promise<boolean> {
      await repo.updateById(id, data)
      log.info('config updated', { config: { action: 'update', id } })
      return true
    },
    async getOne(req: SysConfigQueryDTO): Promise<SysConfigDto> {
      const pojo = await repo.getOne(req)
      if (!pojo) throw new AppError('common.notExist')
      log.info('config fetched', { config: { action: 'getOne' } })
      return pojo
    },
    async getById(id: string): Promise<SysConfigDto> {
      const pojo = await repo.getById(id)
      if (!pojo) throw new AppError('common.notExist')
      log.info('config fetched', { config: { action: 'getById', id } })
      return pojo
    },
    async getValueByKey(key: string): Promise<string | null> {
      const pojo = await repo.getByKey(key)
      log.info('config fetched', { config: { action: 'getValueByKey' } })
      return pojo?.configValue ?? null
    },
    async page(req: SysConfigPageQueryDTO): Promise<OrmPageResp> {
      const { page, pageSize, ...dto } = req
      const result = await repo.page(page, pageSize, dto)
      log.info('config page queried', { config: { action: 'page', page, pageSize, total: result.total } })
      return result
    }
  }
}
