import { sysSystemLogRepo } from './SysSystemLogRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysLogAddDTO, SysLogDto, SysLogPageQueryDTO, SysLogQueryDTO, SysLogUpdateDTO } from "#shared/system/SysLog";
import { randomUuid } from "#shared/utils/uuid";

export function sysSystemLogService(ctx: Context) {
    const repo = sysSystemLogRepo(ctx)

    return {
        async create(data: SysLogAddDTO): Promise<boolean> {
            const uuid = randomUuid()
            const pojo = { ...data, id: uuid }
            await repo.create(pojo)
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
        async updateById(id: string, data: SysLogUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            return true
        },
        async getOne(req: SysLogQueryDTO): Promise<SysLogDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async getById(id: string): Promise<SysLogDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async page(req: SysLogPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            return await repo.page(page, pageSize, dto)
        },
        async list(dto: any): Promise<SysLogDto[]> {
            return await repo.list(dto)
        },
    }
}
