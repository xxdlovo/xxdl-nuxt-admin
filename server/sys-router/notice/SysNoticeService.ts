import { useLogger } from 'evlog'
import { sysNoticeRepo } from './SysNoticeRepo'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysNoticeAddDTO, SysNoticeDto, SysNoticePageQueryDTO, SysNoticePublishStatusDTO, SysNoticeQueryDTO, SysNoticeUpdateDTO } from '#shared/system/notice'
import { randomUuid } from '#shared/utils/uuid'

function withPublishDefaults<T extends SysNoticeAddDTO | SysNoticeUpdateDTO>(data: T) {
    const publishTime = typeof data.publishTime === 'string' && data.publishTime.trim()
        ? data.publishTime.trim()
        : undefined

    return {
        ...data,
        publishTime: data.publishStatus === 1
            ? publishTime ?? new Date().toISOString().slice(0, 19).replace('T', ' ')
            : publishTime ?? null
    }
}

export function sysNoticeService(ctx: Context) {
    const repo = sysNoticeRepo(ctx)
    // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/sys-router/notice')

    return {
        async create(data: SysNoticeAddDTO): Promise<boolean> {
            const uuid = randomUuid()
            const pojo = { ...withPublishDefaults(data), id: uuid }
            await repo.create(pojo)
            log.info('notice created', { notice: { action: 'create', id: uuid } })
            return true
        },
        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            log.info('notice removed', { notice: { action: 'remove', id } })
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            log.info('notice batch removed', { notice: { action: 'batchRemove', count: ids.length } })
            return ids.length
        },
        async updateById(id: string, data: SysNoticeUpdateDTO): Promise<boolean> {
            await repo.updateById(id, withPublishDefaults(data))
            log.info('notice updated', { notice: { action: 'update', id } })
            return true
        },
        async updatePublishStatus(data: SysNoticePublishStatusDTO): Promise<boolean> {
            await repo.updateById(data.id, {
                publishStatus: data.publishStatus
            })
            log.info('notice publish status updated', {
                notice: { action: 'updatePublishStatus', id: data.id, publishStatus: data.publishStatus }
            })
            return true
        },
        async getOne(req: SysNoticeQueryDTO): Promise<SysNoticeDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            log.info('notice fetched', { notice: { action: 'getOne' } })
            return pojo
        },
        async getById(id: string): Promise<SysNoticeDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            log.info('notice fetched', { notice: { action: 'getById', id } })
            return pojo
        },
        async page(req: SysNoticePageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            const result = await repo.page(page, pageSize, dto)
            log.info('notice page queried', {
                notice: { action: 'page', page, pageSize, total: result.total }
            })
            return result
        },
        async list(dto: SysNoticeQueryDTO): Promise<SysNoticeDto[]> {
            const list = await repo.list(dto)
            log.info('notice listed', { notice: { action: 'list', count: list.length } })
            return list
        },
        async latest(limit = 10): Promise<SysNoticeDto[]> {
            const list = await repo.listPublished(Math.min(Math.max(limit, 1), 20))
            log.info('notice latest queried', { notice: { action: 'latest', count: list.length } })
            return list
        },
    }
}
