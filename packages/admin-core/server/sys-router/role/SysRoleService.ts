import { useLogger } from 'evlog'
import { sysRoleRepo } from './SysRoleRepo'
import type { Context } from '#admin/server/trpc/context';
import { AppError } from '#admin/server/utils/appError'
import type { OrmPageResp } from '#admin/server/utils/ApiResp'
import type { SysRoleAddDTO, SysRoleDataScopeUpdateDTO, SysRoleDto, SysRolePageQueryDTO, SysRoleQueryDTO, SysRoleUpdateDTO } from "#admin/shared/system/role";
import { randomUuid } from "#admin/shared/utils/uuid";
import type { RbacRole } from '#admin/shared/auth'
import { rbacCacheService } from '#admin/server/sys-router/storage/cache/RbacCacheService'
import { sysMenuService } from '#admin/server/sys-router/menu/SysMenuService'
import { sysRoleDeptRepo } from '#admin/server/sys-router/roleDept/SysRoleDeptRepo'
import { sysUserRoleRepo } from '#admin/server/sys-router/userRole/SysUserRoleRepo'
import { sysUserRepo } from '#admin/server/sys-router/user/SysUserRepo'
import { assertLastAdmin, assertSystemRoleDeletable, assertSystemRoleProtected } from '#admin/server/utils/adminGuard'
import type { SysRoleAssignUsersDTO } from '#admin/shared/system/role'

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
    const roleDeptRepo = sysRoleDeptRepo(ctx)
    const userRoleRepo = sysUserRoleRepo(ctx)
    const userRepo = sysUserRepo(ctx)
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
            if (!old) {
                throw new AppError('common.notExist')
            }

            // 内置角色是系统初始化语义的一部分，删掉后无法从代码恢复。
            assertSystemRoleDeletable(old)

            await repo.remove(id)
            await roleDeptRepo.removeByRoleId(id, ctx.user?.id ?? null)
            old?.code ? await rbacCache.invalidateRole(old.code) : await rbacCache.invalidateAllRoles()
            await rbacCache.invalidateAllUsers()
            log.info('role removed', { role: { action: 'remove', id } })
            return true
        },
        async batchRemove(ids: string[]): Promise<number> {
            const old = await repo.listByIds(ids)
            if (old.length === 0) {
                return 0
            }

            // 批量操作要么全部成功，要么一个都不删；只要包含系统角色就整批拒绝。
            old.forEach(assertSystemRoleDeletable)

            const roleIds = old.map(role => role.id)
            await repo.batchRemove(roleIds)
            await Promise.all(roleIds.map(id => roleDeptRepo.removeByRoleId(id, ctx.user?.id ?? null)))
            await Promise.all(old.map(role => rbacCache.invalidateRole(role.code)))
            await rbacCache.invalidateAllUsers()
            log.info('role batch removed', { role: { action: 'batchRemove', count: roleIds.length } })
            return roleIds.length
        },
        async updateById(id: string, data: SysRoleUpdateDTO): Promise<boolean> {
            const current = await repo.getById(id)
            if (!current) {
                throw new AppError('common.notExist')
            }

            // 系统角色只允许改展示字段；code/status/dataScope 变更统一拒绝。
            assertSystemRoleProtected(current, data)

            await repo.updateById(id, {
                ...data,
                dataScope: data.dataScope ?? current.dataScope ?? '5'
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
            const current = await repo.getById(data.id)
            if (!current) {
                throw new AppError('common.notExist')
            }

            // updateDataScope 是独立入口，不能绕过系统角色的 dataScope 保护。
            assertSystemRoleProtected(current, { dataScope: data.dataScope })

            await repo.updateById(data.id, {
                dataScope: data.dataScope
            })
            // 只有“自定义数据权限”才保存部门；切回其它范围时清空，避免旧授权残留
            await roleDeptRepo.replaceByRoleId(
                data.id,
                data.dataScope === '2' ? data.deptIds ?? [] : [],
                ctx.user?.id ?? null
            )
            const role = await repo.getById(data.id)
            role?.code ? await rbacCache.invalidateRole(role.code) : await rbacCache.invalidateAllRoles()
            await rbacCache.invalidateAllUsers()
            log.info('role data scope updated', {
                role: { action: 'updateDataScope', id: data.id, dataScope: data.dataScope }
            })
            return true
        },

        /** 自定义数据权限弹窗回显：该角色已授权的部门 */
        async listDeptIds(roleId: string): Promise<string[]> {
            return await roleDeptRepo.listByRoleId(roleId)
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

        /** 角色分配用户弹窗：已分配用户 */
        async listAssignedUsers(roleId: string) {
            return await repo.listAssignedUsers(roleId)
        },

        /** 角色分配用户弹窗：可选用户（关键字搜索） */
        async listAssignableUsers(keyword: string | undefined, limit: number) {
            return await repo.listAssignableUsers(keyword, limit)
        },

        /** 角色分配用户：按 userId 全量 diff，保留历史行 */
        async assignUsers(data: SysRoleAssignUsersDTO): Promise<boolean> {
            const role = await repo.getById(data.roleId)
            if (!role) {
                throw new AppError('common.notExist')
            }

            const userIds = Array.from(new Set(data.userIds.filter(Boolean)))
            const selected = new Set(userIds)
            const existing = await userRoleRepo.listByRoleId(data.roleId)

            // 系统角色移除可用管理员时，必须保证系统里还剩至少一个可用管理员。
            if (role.isSystem === 1) {
                const assignedAdminIds = await userRoleRepo.listAssignedAdminIds(data.roleId)
                const removedAdminIds = assignedAdminIds.filter(userId => !selected.has(userId))

                if (removedAdminIds.length > 0) {
                    assertLastAdmin(await userRepo.countActiveAdmins(removedAdminIds))
                }
            }

            const enableIds = existing
                .filter(row => selected.has(row.userId))
                .map(row => row.id)
            const disableIds = existing
                .filter(row => row.isDeleted === 0 && !selected.has(row.userId))
                .map(row => row.id)
            const insertUserIds = userIds.filter(userId => !existing.some(row => row.userId === userId))

            await userRoleRepo.enableByIds(enableIds, ctx.user?.id ?? null)
            await userRoleRepo.disableByIds(disableIds, ctx.user?.id ?? null)
            await userRoleRepo.createActiveAssignmentsForRole(data.roleId, insertUserIds, ctx.user?.id ?? null)

            const affectedUserIds = Array.from(new Set([
                ...existing.map(row => row.userId),
                ...insertUserIds,
            ]))
            await Promise.all(affectedUserIds.map(userId => rbacCache.invalidateUser(userId)))

            log.info('role users assigned', {
                role: { action: 'assignUsers', id: data.roleId, count: userIds.length }
            })
            return true
        },
    }
}
