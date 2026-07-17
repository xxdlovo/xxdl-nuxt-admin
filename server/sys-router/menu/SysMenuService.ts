import { sysMenuRepo } from './SysMenuRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysMenuAddDTO, SysMenuDto, SysMenuPageQueryDTO, SysMenuQueryDTO, SysMenuUpdateDTO } from "#shared/system/menu";
import { randomUuid } from "#shared/utils/uuid";
import { and, asc, eq, inArray, isNull, or, type SQL } from 'drizzle-orm'
import { sysMenu, sysRoleMenu } from '#server/drizzle/schema'
import type { RbacFlatMenu } from '#shared/auth'

function toRbacFlatMenu(menu: typeof sysMenu.$inferSelect): RbacFlatMenu {
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
        visible: menu.visible ?? 1
    }
}

function enabledPermissionWhere() {
    return and(eq(sysMenu.status, 1), eq(sysMenu.isDeleted, 0))
}

export function sysMenuService(ctx: Context) {
    const repo = sysMenuRepo(ctx)

    return {
        async create(data: SysMenuAddDTO): Promise<string> {
            const uuid = randomUuid()
            const pojo = { ...data, id: uuid }
            await repo.create(pojo)
            return uuid
        },
        async remove(id: string): Promise<boolean> {
            const ids = await repo.listSelfAndDescendantIds([id])
            await repo.batchRemove(ids)
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            if (ids.length === 0) {
                return 0
            }

            const deleteIds = await repo.listSelfAndDescendantIds(ids)
            await repo.batchRemove(deleteIds)
            return deleteIds.length
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
            const { page, pageSize, parentId, ...dto } = req
            const isRootQuery = parentId === '0'
            const extraWhere: SQL[] = []
            if (isRootQuery) {
                const rootParentWhere = or(eq(sysMenu.parentId, '0'), isNull(sysMenu.parentId))
                if (rootParentWhere) {
                    extraWhere.push(rootParentWhere)
                }
            } else if (parentId) {
                extraWhere.push(eq(sysMenu.parentId, parentId))
            }

            return await repo.page(page, pageSize, dto, [asc(sysMenu.sortOrder)], extraWhere)
        },
        async list(dto: any): Promise<SysMenuDto[]> {
            return await repo.list(dto)
        },
        /**
         * List all enabled menu/permission records for an admin user.
         * Visibility and menu type are filtered later by the RBAC tree builder.
         */
        async listEnabledForAdmin(): Promise<RbacFlatMenu[]> {
            const menus = await ctx.db
                .select()
                .from(sysMenu)
                .where(enabledPermissionWhere())

            return menus.map(toRbacFlatMenu)
        },
        /**
         * List enabled menu/permission records granted by the provided role ids.
         * This returns flat records so callers can derive both permission codes and menu trees.
         */
        async listEnabledByRoleIds(roleIds: string[]): Promise<RbacFlatMenu[]> {
            if (roleIds.length === 0) {
                return []
            }

            const menus = await ctx.db
                .select({
                    id: sysMenu.id,
                    parentId: sysMenu.parentId,
                    name: sysMenu.name,
                    code: sysMenu.code,
                    type: sysMenu.type,
                    path: sysMenu.path,
                    component: sysMenu.component,
                    icon: sysMenu.icon,
                    sortOrder: sysMenu.sortOrder,
                    visible: sysMenu.visible,
                    status: sysMenu.status,
                    remark: sysMenu.remark,
                    createdBy: sysMenu.createdBy,
                    createdAt: sysMenu.createdAt,
                    updatedBy: sysMenu.updatedBy,
                    updatedAt: sysMenu.updatedAt,
                    isDeleted: sysMenu.isDeleted
                })
                .from(sysRoleMenu)
                .innerJoin(sysMenu, eq(sysRoleMenu.menuId, sysMenu.id))
                .where(and(
                    inArray(sysRoleMenu.roleId, roleIds),
                    eq(sysRoleMenu.status, 1),
                    eq(sysRoleMenu.isDeleted, 0),
                    enabledPermissionWhere()
                ))

            return menus.map(toRbacFlatMenu)
        },
    }
}
