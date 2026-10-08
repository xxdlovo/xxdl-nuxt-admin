import { useLogger } from 'evlog'
import { sysPayNotifyLogRepo } from './SysPayNotifyLogRepo'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type {
    SysPayNotifyLogAddDTO,
    SysPayNotifyLogDto,
    SysPayNotifyLogPageQueryDTO,
    SysPayNotifyLogQueryDTO,
    SysPayNotifyLogUpdateDTO
} from '#shared/system/payNotifyLog'
import { randomUuid } from '#shared/utils/uuid'

export function sysPayNotifyLogService(ctx: Context) {
    const repo = sysPayNotifyLogRepo(ctx)
    // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/trade-router/payNotifyLog')

    return {
        /** 正常链路里日志由 PayNotifyDispatcher 写入，这里供人工补录 */
        async create(data: SysPayNotifyLogAddDTO): Promise<boolean> {
            const id = randomUuid()
            await repo.create({ ...data, id })
            log.info('payNotifyLog created', { payNotifyLog: { action: 'create', id } })
            return true
        },
        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            log.info('payNotifyLog removed', { payNotifyLog: { action: 'remove', id } })
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            log.info('payNotifyLog batch removed', { payNotifyLog: { action: 'batchRemove', count: ids.length } })
            return ids.length
        },
        async updateById(id: string, data: SysPayNotifyLogUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            log.info('payNotifyLog updated', { payNotifyLog: { action: 'update', id } })
            return true
        },
        async getOne(req: SysPayNotifyLogQueryDTO): Promise<SysPayNotifyLogDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            log.info('payNotifyLog fetched', { payNotifyLog: { action: 'getOne' } })
            return pojo as SysPayNotifyLogDto
        },
        async getById(id: string): Promise<SysPayNotifyLogDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            log.info('payNotifyLog fetched', { payNotifyLog: { action: 'getById', id } })
            return pojo as SysPayNotifyLogDto
        },
        async page(req: SysPayNotifyLogPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, createdFrom, createdTo, ...dto } = req
            const result = await repo.pageWithRange(page, pageSize, dto, { createdFrom, createdTo })
            log.info('payNotifyLog page queried', {
                payNotifyLog: { action: 'page', page, pageSize, total: result.total }
            })
            return result
        },
        async list(dto: SysPayNotifyLogQueryDTO): Promise<SysPayNotifyLogDto[]> {
            const rows = await repo.listRecent(dto)
            log.info('payNotifyLog listed', { payNotifyLog: { action: 'list', count: rows.length } })
            return rows as SysPayNotifyLogDto[]
        }
    }
}
