import { sysDictTypeRepo } from './SysDictTypeRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysDictTypeAddDTO, SysDictTypeDto, SysDictTypePageQueryDTO, SysDictTypeQueryDTO, SysDictTypeUpdateDTO } from "#shared/system/dictType";
import { randomUuid } from "#shared/utils/uuid";

export function sysDictTypeService(ctx: Context) {
    const repo = sysDictTypeRepo(ctx)

    return {
        async create(data: SysDictTypeAddDTO): Promise<boolean> {
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
        async updateById(id: string, data: SysDictTypeUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            return true
        },
        async getOne(req: SysDictTypeQueryDTO): Promise<SysDictTypeDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async getById(id: string): Promise<SysDictTypeDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async page(req: SysDictTypePageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            return await repo.page(page, pageSize, dto)
        },
        async list(dto: any): Promise<SysDictTypeDto[]> {
            return await repo.list(dto)
        },
    }
}
