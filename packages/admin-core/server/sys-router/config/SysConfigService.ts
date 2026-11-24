import { useLogger } from 'evlog'
import type { SysConfigAddDTO, SysConfigDto, SysConfigPageQueryDTO, SysConfigQueryDTO, SysConfigUpdateDTO } from '#admin/shared/system/config'
import { randomUuid } from '#admin/shared/utils/uuid'
import type { Context } from '#admin/server/trpc/context'
import type { OrmPageResp } from '#admin/server/utils/ApiResp'
import { AppError } from '#admin/server/utils/appError'
import { getPublicConfigKeys } from '#admin/server/utils/publicAllowlist'
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
    /**
     * 公开读取单个配置：只认 `publicConfigKeys` 白名单。
     * 白名单外的 key 返回 null（不抛错，避免匿名请求探测配置是否存在）。
     */
    async getPublicValueByKey(key: string): Promise<string | null> {
      if (!getPublicConfigKeys().includes(key)) {
        return null
      }

      const pojo = await repo.getByKey(key)
      return pojo?.configValue ?? null
    },
    /**
     * 公开批量读取配置：非白名单 key 静默忽略。
     *
     * 未登录页面通常一次要读多个开关（注册/验证码/其他登录），批量接口避免多次往返。
     */
    async getPublicValues(keys: string[]): Promise<Record<string, string | null>> {
      const allowedKeys = getPublicConfigKeys()
      const allowed = keys.filter(key => allowedKeys.includes(key))
      if (allowed.length === 0) {
        return {}
      }

      const rows = await repo.getByKeys(allowed)
      const map = new Map(rows.map(row => [row.configKey, row.configValue ?? null]))

      return Object.fromEntries(allowed.map(key => [key, map.get(key) ?? null]))
    },
    async page(req: SysConfigPageQueryDTO): Promise<OrmPageResp> {
      const { page, pageSize, ...dto } = req
      const result = await repo.page(page, pageSize, dto)
      log.info('config page queried', { config: { action: 'page', page, pageSize, total: result.total } })
      return result
    }
  }
}
