import { useLogger } from 'evlog'
import { sysRoleRepo } from './SysRoleRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysRoleAddDTO, SysRoleDataScopeUpdateDTO, SysRoleDto, SysRolePageQueryDTO, SysRoleQueryDTO, SysRoleUpdateDTO } from "#shared/system/role";
import { randomUuid } from "#shared/utils/uuid";
import type { RbacRole } from '#shared/auth'
import { rbacCacheService } from '#server/sys-router/storage/cache/RbacCacheService'
import { sysMenuService } from '#server/sys-router/menu/SysMenuService'

type SysRoleDataScope = NonNullable<SysRoleDto['dataScope']>


function normalizeDataScope(value: unknown): SysRoleDataScope {
    const scope = String(value)
    return ['1', '2', '3', '4', '5', '6'].includes(scope)
        ? scope as SysRoleDataScope
        : '5'
}

function toSysRoleDto(role: any): SysRoleDto | null {
    if (!role) {
        return null
    }

    return {
        ...role,
        dataScope: normalizeDataScope(role.dataScope)
    } as SysRoleDto
}

export function sysRoleService(ctx: Context) {
    const repo = sysRoleRepo(ctx)
    const rbacCache = rbacCacheService()
    // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
    const log = useLogger(ctx.event, 'server/sys-router/role')

    return {
        async create(data: SysRoleAddDTO): Promise<boolean> {
            const uuid = randomUuid()
            const pojo = { ...data, id: uuid }
            await repo.create(pojo)
            log.info('role created', { role: { action: 'create', id: uuid } })
            return true
        },
        async remove(id: string): Promise<boolean> {
            const old = await repo.getById(id)
            await repo.remove(id)
            old?.code ? await rbacCache.invalidateRole(old.code) : await rbacCache.invalidateAllRoles()
            await rbacCache.invalidateAllUsers()
            log.info('role removed', { role: { action: 'remove', id } })
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            const old = await repo.listByIds(ids)
            await repo.batchRemove(ids)
            await Promise.all(old.map(role => rbacCache.invalidateRole(role.code)))
            await rbacCache.invalidateAllUsers()
            log.info('role batch removed', { role: { action: 'batchRemove', count: ids.length } })
            return ids.length
        },
        async updateById(id: string, data: SysRoleUpdateDTO): Promise<boolean> {
            const current = await repo.getById(id)
            await repo.updateById(id, {
                ...data,
                dataScope: data.dataScope ?? current?.dataScope ?? '5'
            })
            if (current?.code && data.code && current.code !== data.code) {
                await Promise.all([rbacCache.invalidateRole(current.code), rbacCache.invalidateRole(data.code)])
            } else if (current?.code) await rbacCache.invalidateRole(current.code)
            else await rbacCache.invalidateAllRoles()
            await rbacCache.invalidateAllUsers()
            log.info('role updated', { role: { action: 'update', id } })
            return true
        },
        async updateDataScope(data: SysRoleDataScopeUpdateDTO): Promise<boolean> {
            await repo.updateById(data.id, {
                dataScope: data.dataScope
            })
            const role = await repo.getById(data.id)
            role?.code ? await rbacCache.invalidateRole(role.code) : await rbacCache.invalidateAllRoles()
            await rbacCache.invalidateAllUsers()
            log.info('role data scope updated', {
                role: { action: 'updateDataScope', id: data.id, dataScope: data.dataScope }
            })
            return true
        },
        async getOne(req: SysRoleQueryDTO): Promise<SysRoleDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            log.info('role fetched', { role: { action: 'getOne' } })
            return pojo
        },
        async getById(id: string): Promise<SysRoleDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            log.info('role fetched', { role: { action: 'getById', id } })
            return pojo
        },
        async page(req: SysRolePageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            const result = await repo.page(page, pageSize, dto)
            log.info('role page queried', { role: { action: 'page', page, pageSize, total: result.total } })
            return result
        },
        async list(dto: any): Promise<SysRoleDto[]> {
            const list = await repo.list(dto)
            log.info('role listed', { role: { action: 'list', count: list.length } })
            return list
        },
        /**
         * List enabled roles actually assigned to a user.
         * Admin privilege is handled by the auth read model, not by faking extra roles here.
         */
        async listEnabledByUserId(userId: string): Promise<RbacRole[]> {
            const list = await repo.listEnabledByUserId(userId)
            log.info('role listed', { role: { action: 'listEnabledByUserId', count: list.length } })
            return list
        },

        /** 可分配的菜单（按菜单类型过滤，供角色授权弹窗使用） */
        async listAssignableMenus(types: Array<0 | 1 | 2>) {
            const menus = await sysMenuService(ctx).list({})

            return menus.filter(menu => menu.type != null && types.includes(menu.type as 0 | 1 | 2))
        },
    }
}
