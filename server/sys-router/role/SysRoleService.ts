import { sysRoleRepo } from './SysRoleRepo'
import type { Context } from '#server/trpc/context';
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type { SysRoleAddDTO, SysRoleDto, SysRolePageQueryDTO, SysRoleQueryDTO, SysRoleUpdateDTO } from "#shared/system/role";
import { randomUuid } from "#shared/utils/uuid";
import { and, eq } from 'drizzle-orm'
import { sysRole, sysUserRole } from '#server/drizzle/schema'
import type { RbacRole } from '#shared/auth'

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

    return {
        async create(data: SysRoleAddDTO): Promise<boolean> {
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
        async updateById(id: string, data: SysRoleUpdateDTO): Promise<boolean> {
            const current = await repo.getById(id)
            await repo.updateById(id, {
                ...data,
                dataScope: data.dataScope ?? current?.dataScope ?? '5'
            })
            return true
        },
        async getOne(req: SysRoleQueryDTO): Promise<SysRoleDto> {
            const pojo = await repo.getOne(req)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async getById(id: string): Promise<SysRoleDto> {
            const pojo = await repo.getById(id)
            if (!pojo) throw new AppError('common.notExist')
            return pojo
        },
        async page(req: SysRolePageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, ...dto } = req
            return await repo.page(page, pageSize, dto)
        },
        async list(dto: any): Promise<SysRoleDto[]> {
            return await repo.list(dto)
        },
        /**
         * List enabled roles actually assigned to a user.
         * Admin privilege is handled by the auth read model, not by faking extra roles here.
         */
        async listEnabledByUserId(userId: string): Promise<RbacRole[]> {
            const roles = await ctx.db
                .select({
                    id: sysRole.id,
                    name: sysRole.name,
                    code: sysRole.code,
                    dataScope: sysRole.dataScope
                })
                .from(sysUserRole)
                .innerJoin(sysRole, eq(sysUserRole.roleId, sysRole.id))
                .where(and(
                    eq(sysUserRole.userId, userId),
                    eq(sysUserRole.status, 1),
                    eq(sysUserRole.isDeleted, 0),
                    eq(sysRole.status, 1),
                    eq(sysRole.isDeleted, 0)
                ))

            return roles
        },
    }
}
