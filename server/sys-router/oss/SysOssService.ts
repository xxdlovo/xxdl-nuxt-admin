import { sysOssRepo } from './SysOssRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysOssAddDTO, SysOssDto, SysOssPageQueryDTO, SysOssQueryDTO, SysOssUpdateDTO } from "#shared/system/oss";
import { randomUuid } from "#shared/utils/uuid";
import { desc } from 'drizzle-orm'
import { sysOss } from '#server/drizzle/schema'

export function sysOssService(ctx: Context) {
    const repo = sysOssRepo(ctx)

    return {
        async create(data: SysOssAddDTO): Promise<boolean> {
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
        async updateById(id: string, data: SysOssUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            return true
        },
        async getOne(req: SysOssQueryDTO): Promise<SysOssDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async getById(id: string): Promise<SysOssDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async page(req: SysOssPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            return await repo.page(page, pageSize, dto, [desc(sysOss.createdAt)])
        },
        async list(dto: any): Promise<SysOssDto[]> {
            return await repo.list(dto, [desc(sysOss.createdAt)])
        },
    }
}
