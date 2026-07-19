import { sysUserRepo } from './SysUserRepo'
import { sysUserRoleRepo } from '#server/sys-router/userRole/SysUserRoleRepo'
import { sysRoleRepo } from '#server/sys-router/role/SysRoleRepo'
import type { Context } from '#server/trpc/context'
import { AppError } from '#server/utils/appError'
import type { OrmPageResp } from '#server/utils/ApiResp'
import type {
  SysUserAddDTO,
  SysUserDto,
  SysUserPageQueryDTO,
  SysUserQueryDTO,
  SysUserResetPasswordDTO,
  SysUserUpdateDTO
} from '#shared/system/user'
import type {
  SysUserRoleAssignedIdsQueryDTO,
  SysUserRoleAssignDTO
} from '#shared/system/userRole'
import { randomUuid } from '#shared/utils/uuid'
import { hashUserPassword } from '#server/utils/password'
import { and, eq } from 'drizzle-orm'
import { sysUser } from '#server/drizzle/schema'

function omitPassword<T extends { password?: unknown } | null>(user: T) {
  if (!user) {
    return user
  }

  const { password, ...safeUser } = user
  return safeUser
}

export function sysUserService(ctx: Context) {
  const repo = sysUserRepo(ctx)
  const userRoleRepo = sysUserRoleRepo(ctx)
  const roleRepo = sysRoleRepo(ctx)

  return {
    async create(data: SysUserAddDTO): Promise<boolean> {
      const pojo = {
        ...data,
        id: randomUuid(),
        password: await hashUserPassword(data.password)
      }
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

    async updateById(id: string, data: SysUserUpdateDTO): Promise<boolean> {
      await repo.updateById(id, data)
      return true
    },

    /**
     * Reset the user's password without checking the old one.
     */
    async resetPassword(data: SysUserResetPasswordDTO): Promise<boolean> {
      const password = await hashUserPassword(data.password)
      await repo.updatePasswordById(data.id, password)
      return true
    },

    async getOne(req: SysUserQueryDTO): Promise<SysUserDto> {
      const pojo = await repo.getOne(req)
      if (!pojo) {
        throw new AppError('common.notExist')
      }
      return omitPassword(pojo) as SysUserDto
    },

    async getById(id: string): Promise<SysUserDto | null> {
      const pojo = await repo.getById(id)
      return omitPassword(pojo) as SysUserDto | null
    },

    async page(req: SysUserPageQueryDTO): Promise<OrmPageResp> {
      const { page, pageSize, ...dto } = req
      const result = await repo.page(page, pageSize, dto)
      return {
        ...result,
        list: result.list.map(omitPassword)
      }
    },

    async list(dto: any): Promise<SysUserDto[]> {
      const result = await repo.list(dto)
      return result.map(omitPassword) as SysUserDto[]
    },

    /**
     * Read the role IDs already linked to a user for the edit form.
     */
    async listAssignedRoleIds(req: SysUserRoleAssignedIdsQueryDTO): Promise<string[]> {
      return await userRoleRepo.listAssignedRoleIds(req)
    },

    /**
     * Replace the user's role bindings by re-enabling existing rows, soft-deleting removed rows,
     * and inserting any new user-role pairs.
     */
    async assignRoles(data: SysUserRoleAssignDTO): Promise<boolean> {
      const roles = await roleRepo.listByIds(Array.from(new Set(data.roleIds)))
      const assignableRoleIds = new Set(
        roles
          .filter(role => role.id && role.isDeleted !== 1)
          .map(role => role.id as string)
      )
      const selectedRoleIds = Array.from(new Set(data.roleIds.filter(id => assignableRoleIds.has(id))))
      const existingRows = await userRoleRepo.listByUserId(data.userId)
      const selectedSet = new Set(selectedRoleIds)
      const existingRoleIds = new Set(existingRows.map(row => row.roleId))
      const enableIds = existingRows
        .filter(row => selectedSet.has(row.roleId))
        .map(row => row.id)
      const disableIds = existingRows
        .filter(row => !selectedSet.has(row.roleId))
        .map(row => row.id)
      const insertRoleIds = selectedRoleIds.filter(id => !existingRoleIds.has(id))
      const operatorId = ctx.user?.id ?? null

      await userRoleRepo.enableByIds(enableIds, operatorId)
      await userRoleRepo.disableByIds(disableIds, operatorId)
      await userRoleRepo.createActiveAssignments(data.userId, insertRoleIds, operatorId)

      return true
    },

    async getLoginUserByUsername(username: string) {
      const users = await ctx.db
        .select()
        .from(sysUser)
        .where(and(eq(sysUser.username, username), eq(sysUser.isDeleted, 0)))
        .limit(1)

      return users[0] ?? null
    }
  }
}
