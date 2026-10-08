import { useLogger } from 'evlog'
import { sysSystemLogRepo } from './SysSystemLogRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysLogAddDTO, SysLogDto, SysLogPageQueryDTO, SysLogQueryDTO, SysLogUpdateDTO } from "#shared/system/SysLog";
import { randomUuid } from "#shared/utils/uuid";

export function sysSystemLogService(ctx: Context) {
    const repo = sysSystemLogRepo(ctx)
    // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/sys-router/systemLog')

    return {
        async create(data: SysLogAddDTO): Promise<boolean> {
            const uuid = randomUuid()
            const pojo = { ...data, id: uuid }
            await repo.create(pojo)
            log.info('systemLog created', { systemLog: { action: 'create', id: uuid } })
            return true
        },
        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            log.info('systemLog removed', { systemLog: { action: 'remove', id } })
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            log.info('systemLog batch removed', { systemLog: { action: 'batchRemove', count: ids.length } })
            return ids.length
        },
        async updateById(id: string, data: SysLogUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            log.info('systemLog updated', { systemLog: { action: 'update', id } })
            return true
        },
        async getOne(req: SysLogQueryDTO): Promise<SysLogDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            log.info('systemLog fetched', { systemLog: { action: 'getOne' } })
            return pojo
        },
        async getById(id: string): Promise<SysLogDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            log.info('systemLog fetched', { systemLog: { action: 'getById', id } })
            return pojo
        },
        async page(req: SysLogPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            const result = await repo.pageRecent(page, pageSize, dto)
            log.info('systemLog page queried', {
                systemLog: { action: 'page', page, pageSize, total: result.total }
            })
            return result
        },
        async list(dto: any): Promise<SysLogDto[]> {
            const list = await repo.listRecent(dto)
            log.info('systemLog listed', { systemLog: { action: 'list', count: list.length } })
            return list
        },
    }
}
