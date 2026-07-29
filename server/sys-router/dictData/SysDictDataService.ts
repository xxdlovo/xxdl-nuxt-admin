import { sysDictDataRepo } from './SysDictDataRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysDictDataAddDTO, SysDictDataDto, SysDictDataPageQueryDTO, SysDictDataQueryDTO, SysDictDataUpdateDTO } from "#shared/system/dictData";
import { randomUuid } from "#shared/utils/uuid";

export function sysDictDataService(ctx: Context) {
    const repo = sysDictDataRepo(ctx)

    return {
        async create(data: SysDictDataAddDTO): Promise<boolean> {
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
        async updateById(id: string, data: SysDictDataUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            return true
        },
        async getOne(req: SysDictDataQueryDTO): Promise<SysDictDataDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async getById(id: string): Promise<SysDictDataDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async page(req: SysDictDataPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            return await repo.page(page, pageSize, dto)
        },
        async list(dto: any): Promise<SysDictDataDto[]> {
            return await repo.list(dto)
        },
        async listByTypeCode(code: string): Promise<SysDictDataDto[]> {
            return await repo.listByTypeCode(code)
        },
    }
}
