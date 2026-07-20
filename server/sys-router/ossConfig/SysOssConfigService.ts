import { sysOssConfigRepo } from './SysOssConfigRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysOssConfigAddDTO, SysOssConfigDto, SysOssConfigPageQueryDTO, SysOssConfigQueryDTO, SysOssConfigUpdateDTO } from "#shared/system/ossConfig";
import { randomUuid } from "#shared/utils/uuid";
import { desc } from 'drizzle-orm'
import { sysOssConfig } from '#server/drizzle/schema'

export function sysOssConfigService(ctx: Context) {
    const repo = sysOssConfigRepo(ctx)

    return {
        async create(data: SysOssConfigAddDTO): Promise<boolean> {
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
        async updateById(id: string, data: SysOssConfigUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            return true
        },
        async getOne(req: SysOssConfigQueryDTO): Promise<SysOssConfigDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async getById(id: string): Promise<SysOssConfigDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async page(req: SysOssConfigPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            return await repo.page(page, pageSize, dto, [desc(sysOssConfig.createdAt)])
        },
        async list(dto: any): Promise<SysOssConfigDto[]> {
            return await repo.list(dto, [desc(sysOssConfig.createdAt)])
        },
    }
}
