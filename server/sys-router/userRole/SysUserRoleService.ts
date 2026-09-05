import { sysUserRoleRepo } from './SysUserRoleRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysUserRoleAddDTO, SysUserRoleDto, SysUserRolePageQueryDTO, SysUserRoleQueryDTO, SysUserRoleUpdateDTO } from "#shared/system/userRole";
import { randomUuid } from "#shared/utils/uuid";
import { rbacCacheService } from '#server/sys-router/storage/cache/RbacCacheService'

export function sysUserRoleService(ctx: Context) {
    const repo = sysUserRoleRepo(ctx)
    const cache = rbacCacheService()

    return {
        async create(data: SysUserRoleAddDTO): Promise<boolean> {
            const uuid = randomUuid()
            const pojo = { ...data, id: uuid }
            await repo.create(pojo)
            await cache.invalidateUser(data.userId)
            return true
        },
        async remove(id: string): Promise<boolean> {
            const old = await repo.getById(id)
            await repo.remove(id)
            old?.userId ? await cache.invalidateUser(old.userId) : await cache.invalidateAllUsers()
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            const old = await Promise.all(ids.map(id => repo.getById(id)))
            await repo.batchRemove(ids)
            const userIds = new Set(old.map(item => item?.userId).filter((id): id is string => Boolean(id)))
            if (userIds.size) await Promise.all([...userIds].map(id => cache.invalidateUser(id)))
            else await cache.invalidateAllUsers()
            return ids.length
        },
        async updateById(id: string, data: SysUserRoleUpdateDTO): Promise<boolean> {
            const old = await repo.getById(id)
            await repo.updateById(id, data)
            const userIds = new Set([old?.userId, data.userId].filter((value): value is string => Boolean(value)))
            if (userIds.size) await Promise.all([...userIds].map(userId => cache.invalidateUser(userId)))
            else await cache.invalidateAllUsers()
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
