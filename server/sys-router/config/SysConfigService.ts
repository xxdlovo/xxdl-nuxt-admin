import type { SysConfigAddDTO, SysConfigDto, SysConfigPageQueryDTO, SysConfigQueryDTO, SysConfigUpdateDTO } from '#shared/system/config'
import { randomUuid } from '#shared/utils/uuid'
import type { Context } from '#server/trpc/context'
import type { OrmPageResp } from '#server/utils/ApiResp'
import { AppError } from '#server/utils/appError'
import { sysConfigRepo } from './SysConfigRepo'

export function sysConfigService(ctx: Context) {
  const repo = sysConfigRepo(ctx)

  return {
    async create(data: SysConfigAddDTO): Promise<boolean> {
      await repo.create({ ...data, id: randomUuid() })
      return true
    },
    async remove(id: string): Promise<boolean> {
      await repo.remove(id)
      return true
    },
    async batchRemove(ids: string[]): Promise<number> {
      await repo.batchRemove(ids)
      return ids.length
    },
    async updateById(id: string, data: SysConfigUpdateDTO): Promise<boolean> {
      await repo.updateById(id, data)
      return true
    },
    async getOne(req: SysConfigQueryDTO): Promise<SysConfigDto> {
      const pojo = await repo.getOne(req)
      if (!pojo) throw new AppError('common.notExist')
      return pojo
    },
    async getById(id: string): Promise<SysConfigDto> {
      const pojo = await repo.getById(id)
      if (!pojo) throw new AppError('common.notExist')
      return pojo
    },
    async getValueByKey(key: string): Promise<string | null> {
      const pojo = await repo.getByKey(key)
      return pojo?.configValue ?? null
    },
    async page(req: SysConfigPageQueryDTO): Promise<OrmPageResp> {
      const { page, pageSize, ...dto } = req
      return repo.page(page, pageSize, dto)
    }
  }
}
