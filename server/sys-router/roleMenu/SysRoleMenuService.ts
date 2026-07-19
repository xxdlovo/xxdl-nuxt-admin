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

            return true
        },
    }
}
