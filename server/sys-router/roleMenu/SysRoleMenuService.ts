import { sysRoleMenuRepo } from './SysRoleMenuRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysRoleMenuAddDTO, SysRoleMenuDto, SysRoleMenuPageQueryDTO, SysRoleMenuQueryDTO, SysRoleMenuUpdateDTO } from "#shared/system/roleMenu";
import { randomUuid } from "#shared/utils/uuid";

export function sysRoleMenuService(ctx: Context) {
    const repo = sysRoleMenuRepo(ctx)

    return {
        async create(data: SysRoleMenuAddDTO): Promise<boolean> {
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
        async updateById(id: string, data: SysRoleMenuUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            return true
        },
        async getOne(req: SysRoleMenuQueryDTO): Promise<SysRoleMenuDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async getById(id: string): Promise<SysRoleMenuDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async page(req: SysRoleMenuPageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            return await repo.page(page, pageSize, dto)
        },
        async list(dto: any): Promise<SysRoleMenuDto[]> {
            return await repo.list(dto)
        },
    }
}
