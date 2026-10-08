import { useLogger } from 'evlog'
import type { Context } from '#server/trpc/context'
import type { OrmPageResp } from '#server/utils/ApiResp'
import { AppError } from '#server/utils/appError'
import type { SysJobAddDTO, SysJobDto, SysJobPageQueryDTO, SysJobQueryDTO, SysJobUpdateDTO } from '#shared/system/job'
import { randomUuid } from '#shared/utils/uuid'
import { assertValidCron, formatMysqlDate, nextRunAt } from './cron'
import { hasSysJobHandler, listSysJobHandlers } from './handlers'
import { sysJobRepo } from './SysJobRepo'

function validateTask(data: SysJobAddDTO | SysJobUpdateDTO) {
  if (!hasSysJobHandler(data.handlerCode)) {
    throw new AppError('module.system.job.handlerMissing')
  }
  if (data.cronTimezone !== 'Asia/Shanghai') {
    throw new AppError('module.system.job.timezoneUnsupported')
  }

  try {
    assertValidCron(data.cronExpression)
  } catch {
    throw new AppError('module.system.job.cronInvalid')
  }
}

function taskValues(data: SysJobAddDTO | SysJobUpdateDTO) {
  const nextRun = data.status === 1
    ? formatMysqlDate(nextRunAt(data.cronExpression))
    : null

  return {
    ...data,
    cronTimezone: 'Asia/Shanghai',
    nextRunAt: nextRun
  }
}

export function sysJobService(ctx: Context) {
  const repo = sysJobRepo(ctx)
  // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
  const log = useLogger(ctx.event, 'server/sys-router/job')

  return {
    async create(data: SysJobAddDTO): Promise<boolean> {
      validateTask(data)
      const id = randomUuid()
      await repo.create({ ...taskValues(data), id, runningStatus: 0 })
      log.info('job created', { job: { action: 'create', id } })
      return true
    },
    async remove(id: string): Promise<boolean> {
      await repo.remove(id)
      log.info('job removed', { job: { action: 'remove', id } })
      return true
    },
    async batchRemove(ids: string[]): Promise<number> {
      await repo.batchRemove(ids)
      log.info('job batch removed', { job: { action: 'batchRemove', count: ids.length } })
      return ids.length
    },
    async updateById(id: string, data: SysJobUpdateDTO): Promise<boolean> {
      validateTask(data)
      await repo.updateById(id, taskValues(data))
      log.info('job updated', { job: { action: 'update', id } })
      return true
    },
    async enable(id: string): Promise<boolean> {
      const job = await repo.getById(id)
      if (!job) throw new AppError('common.notExist')
      if (!hasSysJobHandler(job.handlerCode)) {
        throw new AppError('module.system.job.handlerMissing')
      }
      assertValidCron(job.cronExpression)
      await repo.updateById(id, {
        status: 1,
        nextRunAt: formatMysqlDate(nextRunAt(job.cronExpression))
      })
      log.info('job enabled', { job: { action: 'enable', id } })
      return true
    },
    async disable(id: string): Promise<boolean> {
      const job = await repo.getById(id)
      if (!job) throw new AppError('common.notExist')
      await repo.updateById(id, { status: 0, nextRunAt: null })
      log.info('job disabled', { job: { action: 'disable', id } })
      return true
    },
    async getOne(req: SysJobQueryDTO): Promise<SysJobDto> {
      const pojo = await repo.getOne(req)
      if (!pojo) throw new AppError('common.notExist')
      log.info('job fetched', { job: { action: 'getOne' } })
      return pojo
    },
    async getById(id: string): Promise<SysJobDto> {
      const pojo = await repo.getById(id)
      if (!pojo) throw new AppError('common.notExist')
      log.info('job fetched', { job: { action: 'getById', id } })
      return pojo
    },
    async page(req: SysJobPageQueryDTO): Promise<OrmPageResp> {
      const { page, pageSize, ...dto } = req
      const result = await repo.page(page, pageSize, dto)
      log.info('job page queried', { job: { action: 'page', page, pageSize, total: result.total } })
      return result
    },
    async list(dto: SysJobQueryDTO): Promise<SysJobDto[]> {
      const list = await repo.listRecent(dto)
      log.info('job listed', { job: { action: 'list', count: list.length } })
      return list
    },
    availableHandlers() {
      return listSysJobHandlers()
    }
  }
}
