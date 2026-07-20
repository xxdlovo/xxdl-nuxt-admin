import { sysLoginLogRepo } from './SysLoginLogRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysLoginLogAddDTO, SysLoginLogDto, SysLoginLogPageQueryDTO, SysLoginLogQueryDTO, SysLoginLogUpdateDTO } from "#shared/system/loginLog";
import { randomUuid } from "#shared/utils/uuid";
import { desc } from 'drizzle-orm'
import { sysLoginLog } from '#server/drizzle/schema'

export function sysLoginLogService(ctx: Context) {
    const repo = sysLoginLogRepo(ctx)

    return {
        async create(data: SysLoginLogAddDTO): Promise<boolean> {
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
        async updateById(id: string, data: SysLoginLogUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            return true
        },
        async getOne(req: SysLoginLogQueryDTO): Promise<SysLoginLogDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async getById(id: string): Promise<SysLoginLogDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async page(req: SysLoginLogPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            return await repo.page(page, pageSize, dto, [desc(sysLoginLog.createdAt)])
        },
        async list(dto: any): Promise<SysLoginLogDto[]> {
            return await repo.list(dto, [desc(sysLoginLog.createdAt)])
        },
    }
}
