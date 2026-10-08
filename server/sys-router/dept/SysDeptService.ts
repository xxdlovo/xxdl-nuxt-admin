import { useLogger } from 'evlog'
import { sysDeptRepo } from './SysDeptRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysDeptAddDTO, SysDeptDto, SysDeptPageQueryDTO, SysDeptQueryDTO, SysDeptUpdateDTO } from "#shared/system/department";
import { randomUuid } from "#shared/utils/uuid";

export function sysDeptService(ctx: Context) {
    const repo = sysDeptRepo(ctx)
    // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/sys-router/dept')

    return {
        async create(data: SysDeptAddDTO): Promise<boolean> {
            const uuid = randomUuid()
            const pojo = { ...data, id: uuid }
            await repo.create(pojo)
            log.info('dept created', { dept: { action: 'create', id: uuid } })
            return true
        },
        async remove(id: string): Promise<boolean> {
            await repo.remove(id)
            log.info('dept removed', { dept: { action: 'remove', id } })
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            await repo.batchRemove(ids)
            log.info('dept batch removed', { dept: { action: 'batchRemove', count: ids.length } })
            return ids.length
        },
        async updateById(id: string, data: SysDeptUpdateDTO): Promise<boolean> {
            if (data.parentId && data.parentId === id) {
                throw new AppError('module.system.department.parentCannotSelf')
            }

            await repo.updateById(id, data)
            log.info('dept updated', { dept: { action: 'update', id } })
            return true
        },
        async getOne(req: SysDeptQueryDTO): Promise<SysDeptDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            log.info('dept fetched', { dept: { action: 'getOne' } })
            return pojo
        },
        async getById(id: string): Promise<SysDeptDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            log.info('dept fetched', { dept: { action: 'getById', id } })
            return pojo
        },
        async page(req: SysDeptPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, parentId, ...dto } = req

            // 层级过滤与排序都在 SysDeptRepo（mapper 层）
            const result = await repo.pageByParent(page, pageSize, dto, parentId)
            log.info('dept page queried', { dept: { action: 'page', page, pageSize, total: result.total } })
            return result
        },
        async list(dto: any): Promise<SysDeptDto[]> {
            const list = await repo.list(dto)
            log.info('dept listed', { dept: { action: 'list', count: list.length } })
            return list
        },
    }
}
