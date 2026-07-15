import { sysMenuRepo } from './SysMenuRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysMenuAddDTO, SysMenuDto, SysMenuPageQueryDTO, SysMenuQueryDTO, SysMenuUpdateDTO } from "#shared/system/menu";
import { randomUuid } from "#shared/utils/uuid";

export function sysMenuService(ctx: Context) {
    const repo = sysMenuRepo(ctx)

    return {
        async create(data: SysMenuAddDTO): Promise<boolean> {
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
        async updateById(id: string, data: SysMenuUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            return true
        },
        async getOne(req: SysMenuQueryDTO): Promise<SysMenuDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async getById(id: string): Promise<SysMenuDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async page(req: SysMenuPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            return await repo.page(page, pageSize, dto)
        },
        async list(dto: any): Promise<SysMenuDto[]> {
            return await repo.list(dto)
        },
    }
}
