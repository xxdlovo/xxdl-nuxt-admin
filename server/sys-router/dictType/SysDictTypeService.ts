import { useLogger } from 'evlog'
import { sysDictTypeRepo } from './SysDictTypeRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysDictTypeAddDTO, SysDictTypeDto, SysDictTypePageQueryDTO, SysDictTypeQueryDTO, SysDictTypeUpdateDTO } from "#shared/system/dictType";
import { randomUuid } from "#shared/utils/uuid";
import { dictCacheService } from '#server/sys-router/storage/cache/DictCacheService'

export function sysDictTypeService(ctx: Context) {
    const repo = sysDictTypeRepo(ctx)
    const cache = dictCacheService()
    // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/sys-router/dictType')

    return {
        async create(data: SysDictTypeAddDTO): Promise<boolean> {
            const uuid = randomUuid()
            const pojo = { ...data, id: uuid }
            await repo.create(pojo)
            log.info('dictType created', { dictType: { action: 'create', id: uuid } })
            return true
        },
        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            await cache.invalidateAll()
            log.info('dictType removed', { dictType: { action: 'remove', id } })
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            await cache.invalidateAll()
            log.info('dictType batch removed', { dictType: { action: 'batchRemove', count: ids.length } })
            return ids.length
        },
        async updateById(id: string, data: SysDictTypeUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            await cache.invalidateAll()
            log.info('dictType updated', { dictType: { action: 'update', id } })
            return true
        },
        async getOne(req: SysDictTypeQueryDTO): Promise<SysDictTypeDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            log.info('dictType fetched', { dictType: { action: 'getOne' } })
            return pojo
        },
        async getById(id: string): Promise<SysDictTypeDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            log.info('dictType fetched', { dictType: { action: 'getById', id } })
            return pojo
        },
        async page(req: SysDictTypePageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            const result = await repo.page(page, pageSize, dto)
            log.info('dictType page queried', { dictType: { action: 'page', page, pageSize, total: result.total } })
            return result
        },
        async list(dto: any): Promise<SysDictTypeDto[]> {
            const list = await repo.list(dto)
            log.info('dictType listed', { dictType: { action: 'list', count: list.length } })
            return list
        },
    }
}
