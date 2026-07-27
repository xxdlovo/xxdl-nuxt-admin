import { desc } from 'drizzle-orm'
import type { Context } from '#server/trpc/context'
import type { OrmPageResp } from '#server/utils/ApiResp'
import { AppError } from '#server/utils/appError'
import type { SysJobAddDTO, SysJobDto, SysJobPageQueryDTO, SysJobQueryDTO, SysJobUpdateDTO } from '#shared/system/job'
import { randomUuid } from '#shared/utils/uuid'
import { sysJob } from '#server/drizzle/schema'
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

  return {
    async create(data: SysJobAddDTO): Promise<boolean> {
      validateTask(data)
      await repo.create({ ...taskValues(data), id: randomUuid(), runningStatus: 0 })
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
    async updateById(id: string, data: SysJobUpdateDTO): Promise<boolean> {
      validateTask(data)
      await repo.updateById(id, taskValues(data))
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
      return true
    },
    async disable(id: string): Promise<boolean> {
      const job = await repo.getById(id)
      if (!job) throw new AppError('common.notExist')
      await repo.updateById(id, { status: 0, nextRunAt: null })
      return true
    },
    async getOne(req: SysJobQueryDTO): Promise<SysJobDto> {
      const pojo = await repo.getOne(req)
      if (!pojo) throw new AppError('common.notExist')
      return pojo
    },
    async getById(id: string): Promise<SysJobDto> {
      const pojo = await repo.getById(id)
      if (!pojo) throw new AppError('common.notExist')
      return pojo
    },
    async page(req: SysJobPageQueryDTO): Promise<OrmPageResp> {
      const { page, pageSize, ...dto } = req
      return repo.page(page, pageSize, dto)
    },
    async list(dto: SysJobQueryDTO): Promise<SysJobDto[]> {
      return repo.list(dto, [desc(sysJob.createdAt)])
    },
    availableHandlers() {
      return listSysJobHandlers()
    }
  }
}
