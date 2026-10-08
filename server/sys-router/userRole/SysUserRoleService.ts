import { useLogger } from 'evlog'
import { sysUserRoleRepo } from './SysUserRoleRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysUserRoleAddDTO, SysUserRoleDto, SysUserRolePageQueryDTO, SysUserRoleQueryDTO, SysUserRoleUpdateDTO } from "#shared/system/userRole";
import { randomUuid } from "#shared/utils/uuid";
import { rbacCacheService } from '#server/sys-router/storage/cache/RbacCacheService'

export function sysUserRoleService(ctx: Context) {
    const repo = sysUserRoleRepo(ctx)
    // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/sys-router/userRole')
    const cache = rbacCacheService()

    return {
        async create(data: SysUserRoleAddDTO): Promise<boolean> {
            const uuid = randomUuid()
            const pojo = { ...data, id: uuid }
            await repo.create(pojo)
            await cache.invalidateUser(data.userId)
            log.info('userRole created', { userRole: { action: 'create', id: uuid } })
            return true
        },
        async remove(id: string): Promise<boolean> {
            const old = await repo.getById(id)
            await repo.remove(id)
            old?.userId ? await cache.invalidateUser(old.userId) : await cache.invalidateAllUsers()
            log.info('userRole removed', { userRole: { action: 'remove', id } })
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            const old = await Promise.all(ids.map(id => repo.getById(id)))
            await repo.batchRemove(ids)
            const userIds = new Set(old.map(item => item?.userId).filter((id): id is string => Boolean(id)))
            if (userIds.size) await Promise.all([...userIds].map(id => cache.invalidateUser(id)))
            else await cache.invalidateAllUsers()
            log.info('userRole batch removed', { userRole: { action: 'batchRemove', count: ids.length } })
            return ids.length
        },
        async updateById(id: string, data: SysUserRoleUpdateDTO): Promise<boolean> {
            const old = await repo.getById(id)
            await repo.updateById(id, data)
            const userIds = new Set([old?.userId, data.userId].filter((value): value is string => Boolean(value)))
            if (userIds.size) await Promise.all([...userIds].map(userId => cache.invalidateUser(userId)))
            else await cache.invalidateAllUsers()
            log.info('userRole updated', { userRole: { action: 'update', id } })
            return true
        },
        async getOne(req: SysUserRoleQueryDTO): Promise<SysUserRoleDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            log.info('userRole fetched', { userRole: { action: 'getOne' } })
            return pojo
        },
        async getById(id: string): Promise<SysUserRoleDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            log.info('userRole fetched', { userRole: { action: 'getById', id } })
            return pojo
        },
        async page(req: SysUserRolePageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            const result = await repo.page(page, pageSize, dto)
            log.info('userRole page queried', {
                userRole: { action: 'page', page, pageSize, total: result.total }
            })
            return result
        },
        async list(dto: any): Promise<SysUserRoleDto[]> {
            const list = await repo.list(dto)
            log.info('userRole listed', { userRole: { action: 'list', count: list.length } })
            return list
        },
    }
}
