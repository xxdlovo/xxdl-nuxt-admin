import { sysMenuRepo, type SysMenuRow } from './SysMenuRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysMenuAddDTO, SysMenuDto, SysMenuPageQueryDTO, SysMenuQueryDTO, SysMenuUpdateDTO } from "#shared/system/menu";
import { randomUuid } from "#shared/utils/uuid";
import type { RbacFlatMenu } from '#shared/auth'
import { rbacCacheService } from '#server/sys-router/storage/cache/RbacCacheService'

function toRbacFlatMenu(menu: SysMenuRow): RbacFlatMenu {
    return {
        id: menu.id,
        parentId: menu.parentId ?? null,
        name: menu.name,
        code: menu.code,
        type: menu.type,
        path: menu.path ?? null,
        component: menu.component ?? null,
        icon: menu.icon ?? null,
        sortOrder: menu.sortOrder ?? 0,
        visible: menu.visible ?? 0
    }
}

export function sysMenuService(ctx: Context) {
    const repo = sysMenuRepo(ctx)
    const rbacCache = rbacCacheService()

    return {
        async create(data: SysMenuAddDTO): Promise<string> {
            const uuid = randomUuid()
            const pojo = { ...data, id: uuid }
            await repo.create(pojo)
            await Promise.all([rbacCache.invalidateAllRoles(), rbacCache.invalidateAdmin()])
            return uuid
        },
        async remove(id: string): Promise<boolean> {
            const ids = await repo.listSelfAndDescendantIds([id])
            await repo.batchRemove(ids)
            await Promise.all([rbacCache.invalidateAllRoles(), rbacCache.invalidateAdmin()])
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            if (ids.length === 0) {
                return 0
            }

            const deleteIds = await repo.listSelfAndDescendantIds(ids)
            await repo.batchRemove(deleteIds)
            await Promise.all([rbacCache.invalidateAllRoles(), rbacCache.invalidateAdmin()])
            return deleteIds.length
        },
        async updateById(id: string, data: SysMenuUpdateDTO): Promise<boolean> {
            await repo.updateById(id, data)
            await Promise.all([rbacCache.invalidateAllRoles(), rbacCache.invalidateAdmin()])
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
            const { page, pageSize, parentId, ...dto } = req

            return await repo.pageByParent(page, pageSize, dto, parentId)
        },
        async list(dto: any): Promise<SysMenuDto[]> {
            return await repo.list(dto)
        },
        /**
         * List all enabled menu/permission records for an admin user.
         * Visibility and menu type are filtered later by the RBAC tree builder.
         */
        async listEnabledForAdmin(): Promise<RbacFlatMenu[]> {
            const menus = await repo.listEnabledRows()

            return menus.map(toRbacFlatMenu)
        },
        /**
         * List enabled menu/permission records granted by the provided role ids.
         * This returns flat records so callers can derive both permission codes and menu trees.
         */
        async listEnabledByRoleIds(roleIds: string[]): Promise<RbacFlatMenu[]> {
            const menus = await repo.listEnabledRowsByRoleIds(roleIds)

            return menus.map(toRbacFlatMenu)
        },
    }
}
