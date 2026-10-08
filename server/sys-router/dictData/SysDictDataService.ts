import { useLogger } from 'evlog'
import { sysDictDataRepo } from './SysDictDataRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysDictDataAddDTO, SysDictDataDto, SysDictDataPageQueryDTO, SysDictDataQueryDTO, SysDictDataUpdateDTO } from "#shared/system/dictData";
import { randomUuid } from "#shared/utils/uuid";
import { dictCacheService } from '#server/sys-router/storage/cache/DictCacheService'
import { sysDictTypeRepo } from '#server/sys-router/dictType/SysDictTypeRepo'

export function sysDictDataService(ctx: Context) {
    const repo = sysDictDataRepo(ctx)
    // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/sys-router/dictData')
    const typeRepo = sysDictTypeRepo(ctx)
    const cache = dictCacheService()

    return {
        async create(data: SysDictDataAddDTO): Promise<boolean> {
            const uuid = randomUuid()
            const pojo = { ...data, id: uuid }
            await repo.create(pojo)
            log.info('dictData created', { dictData: { action: 'create', id: uuid } })
            if (data.typeId) {
                const code = await typeRepo.getCodeById(data.typeId)
                code ? await cache.invalidate(code) : await cache.invalidateAll()
            } else await cache.invalidateAll()
            return true
        },
        async remove(id: string): Promise<boolean> {
            const old = await repo.getById(id)
            await repo.remove(id)
            log.info('dictData removed', { dictData: { action: 'remove', id } })
            if (old?.typeId) {
                const code = await typeRepo.getCodeById(old.typeId)
                code ? await cache.invalidate(code) : await cache.invalidateAll()
            } else await cache.invalidateAll()
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            log.info('dictData batch removed', { dictData: { action: 'batchRemove', count: ids.length } })
            await cache.invalidateAll()
            return ids.length
        },
        async updateById(id: string, data: SysDictDataUpdateDTO): Promise<boolean> {
            const old = await repo.getById(id)
            await repo.updateById(id, data)
            log.info('dictData updated', { dictData: { action: 'update', id } })
            const typeIds = new Set([old?.typeId, data.typeId].filter((id): id is string => Boolean(id)))
            if (typeIds.size === 0) await cache.invalidateAll()
            else {
                const codes = await typeRepo.listCodesByIds([...typeIds])
                if (codes.length === 0) await cache.invalidateAll()
                else await Promise.all(codes.map(code => cache.invalidate(code)))
            }
            return true
        },
        async getOne(req: SysDictDataQueryDTO): Promise<SysDictDataDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            log.info('dictData fetched', { dictData: { action: 'getOne' } })
            return pojo
        },
        async getById(id: string): Promise<SysDictDataDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            log.info('dictData fetched', { dictData: { action: 'getById', id } })
            return pojo
        },
        async page(req: SysDictDataPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            const result = await repo.page(page, pageSize, dto)
            log.info('dictData page queried', { dictData: { action: 'page', page, pageSize, total: result.total } })
            return result
        },
        async list(dto: any): Promise<SysDictDataDto[]> {
            const list = await repo.list(dto)
            log.info('dictData listed', { dictData: { action: 'list', count: list.length } })
            return list
        },
        async listByTypeCode(code: string): Promise<SysDictDataDto[]> {
            const list = await cache.getByTypeCode(code, () => repo.listByTypeCode(code))
            log.info('dictData listed', { dictData: { action: 'listByTypeCode', count: list.length } })
            return list
        },
    }
}
