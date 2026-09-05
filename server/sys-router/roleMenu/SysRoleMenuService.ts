import { sysRoleMenuRepo } from './SysRoleMenuRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type {
    SysRoleMenuAddDTO,
    SysRoleMenuAssignedIdsQueryDTO,
    SysRoleMenuAssignDTO,
    SysRoleMenuDto,
    SysRoleMenuPageQueryDTO,
    SysRoleMenuQueryDTO,
    SysRoleMenuUpdateDTO
} from "#shared/system/roleMenu";
import { randomUuid } from "#shared/utils/uuid";
import { rbacCacheService } from '#server/sys-router/storage/cache/RbacCacheService'
import { sysRoleRepo } from '#server/sys-router/role/SysRoleRepo'

export function sysRoleMenuService(ctx: Context) {
    const repo = sysRoleMenuRepo(ctx)
    const roleRepo = sysRoleRepo(ctx)
    const rbacCache = rbacCacheService()

    return {
        async create(data: SysRoleMenuAddDTO): Promise<boolean> {
            const uuid = randomUuid()
            const pojo = { ...data, id: uuid }
            await repo.create(pojo)
            const role = await roleRepo.getById(data.roleId)
            role?.code ? await rbacCache.invalidateRole(role.code) : await rbacCache.invalidateAllRoles()
            return true
        },
        async remove(id: string): Promise<boolean> {
            const old = await repo.getById(id)
            await repo.remove(id)
            const role = old?.roleId ? await roleRepo.getById(old.roleId) : null
            role?.code ? await rbacCache.invalidateRole(role.code) : await rbacCache.invalidateAllRoles()
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            const old = await Promise.all(ids.map(id => repo.getById(id)))
            await repo.batchRemove(ids)
            const roles = await Promise.all(old.map(item => item?.roleId ? roleRepo.getById(item.roleId) : null))
            const codes = new Set(roles.map(role => role?.code).filter((code): code is string => Boolean(code)))
            if (codes.size) await Promise.all([...codes].map(code => rbacCache.invalidateRole(code)))
            else await rbacCache.invalidateAllRoles()
            return ids.length
        },
        async updateById(id: string, data: SysRoleMenuUpdateDTO): Promise<boolean> {
            const old = await repo.getById(id)
            await repo.updateById(id, data)
            const roleIds = new Set([old?.roleId, data.roleId].filter((value): value is string => Boolean(value)))
            const roles = await Promise.all([...roleIds].map(roleId => roleRepo.getById(roleId)))
            const codes = new Set(roles.map(role => role?.code).filter((code): code is string => Boolean(code)))
            if (codes.size) await Promise.all([...codes].map(code => rbacCache.invalidateRole(code)))
            else await rbacCache.invalidateAllRoles()
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
        /**
         * Query the menu or button IDs already assigned to a role.
         * The menu type filter lets the role edit dialog reuse one relation table for menu permissions and button permissions.
         */
        async listAssignedMenuIds(req: SysRoleMenuAssignedIdsQueryDTO): Promise<string[]> {
            return await repo.listAssignedMenuIds(req)
        },
        /**
         * Replace a role's permissions within the requested menu types.
         * Existing rows are re-enabled or soft-deleted, and only new role-menu pairs are inserted.
         */
        async assignByRoleAndTypes(data: SysRoleMenuAssignDTO): Promise<boolean> {
            const assignableIds = await repo.listMenuIdsByTypes(data.types)
            const assignableMenuIds = new Set(assignableIds)
            const selectedMenuIds = Array.from(new Set(data.menuIds.filter(id => assignableMenuIds.has(id))))
            const existingRows = await repo.listByRoleIdAndMenuIds(data.roleId, Array.from(assignableMenuIds))
            const selectedSet = new Set(selectedMenuIds)
            const existingMenuIds = new Set(existingRows.map(row => row.menuId))
            const enableIds = existingRows
                .filter(row => selectedSet.has(row.menuId))
                .map(row => row.id)
            const disableIds = existingRows
                .filter(row => !selectedSet.has(row.menuId))
                .map(row => row.id)
            const insertMenuIds = selectedMenuIds.filter(id => !existingMenuIds.has(id))
            const operatorId = ctx.user?.id ?? null

            await repo.enableByIds(enableIds, operatorId)
            await repo.disableByIds(disableIds, operatorId)
            await repo.createActiveAssignments(data.roleId, insertMenuIds, operatorId)
            const role = await roleRepo.getById(data.roleId)
            role?.code ? await rbacCache.invalidateRole(role.code) : await rbacCache.invalidateAllRoles()

            return true
        },
    }
}
