import { sysUserRoleRepo } from './SysUserRoleRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysUserRoleAddDTO, SysUserRoleDto, SysUserRolePageQueryDTO, SysUserRoleQueryDTO, SysUserRoleUpdateDTO } from "#shared/system/userRole";
import { randomUuid } from "#shared/utils/uuid";

export function sysUserRoleService(ctx: Context) {
    const repo = sysUserRoleRepo(ctx)

    return {
        async create(data: SysUserRoleAddDTO): Promise<boolean> {
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
        async updateById(id: string, data: SysUserRoleUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            return true
        },
        async getOne(req: SysUserRoleQueryDTO): Promise<SysUserRoleDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async getById(id: string): Promise<SysUserRoleDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async page(req: SysUserRolePageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            return await repo.page(page, pageSize, dto)
        },
        async list(dto: any): Promise<SysUserRoleDto[]> {
            return await repo.list(dto)
        },
    }
}
