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
  SysUserRegisterDTO,
  SysUserResetPasswordDTO,
  SysUserUpdateDTO
} from '#shared/system/user'
import type {
  SysUserRoleAssignedIdsQueryDTO,
  SysUserRoleAssignDTO
} from '#shared/system/userRole'
import { randomUuid } from '#shared/utils/uuid'
import { hashUserPassword, isPlaceholderPassword } from '#server/utils/password'
import { and, eq } from 'drizzle-orm'
import { sysDepartment, sysUser } from '#server/drizzle/schema'
import { rbacCacheService } from '#server/sys-router/storage/cache/RbacCacheService'

function omitPassword<T extends { password?: unknown } | null>(user: T) {
  if (!user) {
    return user
  }

  const { password, ...safeUser } = user
  return safeUser
}

function normalizeDeptId(value: unknown) {
  return typeof value === 'string' && value ? value : null
}

export function sysUserService(ctx: Context) {
  const repo = sysUserRepo(ctx)
  const userRoleRepo = sysUserRoleRepo(ctx)
  const roleRepo = sysRoleRepo(ctx)
  const rbacCache = rbacCacheService()

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

    async register(data: SysUserRegisterDTO): Promise<boolean> {
      const existingUsername = await ctx.db
        .select({ id: sysUser.id })
        .from(sysUser)
        .where(eq(sysUser.username, data.username))
        .limit(1)

      if (existingUsername[0]) {
        throw new AppError('auth.usernameExists')
      }

      const existingPhone = await ctx.db
        .select({ id: sysUser.id })
        .from(sysUser)
        .where(eq(sysUser.phone, data.phone))
        .limit(1)

      if (existingPhone[0]) {
        throw new AppError('auth.phoneExists')
      }

      await repo.create({
        id: randomUuid(),
        username: data.username,
        password: await hashUserPassword(data.password),
        email: `${data.username}@registered.local`,
        nickname: data.username,
        phone: data.phone,
        gender: 0,
        isAdmin: 0,
        status: 1
      })

      return true
    },

    async remove(id: string): Promise<boolean> {
      await repo.remove(id)
      await rbacCache.invalidateUser(id)
      return true
    },

    async batchRemove(ids: string[]): Promise<number> {
      await repo.batchRemove(ids)
      await Promise.all(ids.map(id => rbacCache.invalidateUser(id)))
      return ids.length
    },

    async updateById(id: string, data: SysUserUpdateDTO): Promise<boolean> {
      const { id: _inputId, ...values } = data
      const deptId = normalizeDeptId(data.deptId)
      const current = await repo.getById(id)

      if (!current) {
        throw new AppError('common.notExist')
      }

      if (deptId) {
        const deptRows = await ctx.db
          .select({ id: sysDepartment.id })
          .from(sysDepartment)
          .where(and(eq(sysDepartment.id, deptId), eq(sysDepartment.isDeleted, 0)))
          .limit(1)

        if (!deptRows[0]) {
          throw new AppError('common.notExist')
        }
      }

      await repo.updateById(id, {
        ...values,
        deptId
      })
      if (data.status !== undefined) await rbacCache.invalidateUser(id)
      const updatedRows = await ctx.db
        .select({ deptId: sysUser.deptId })
        .from(sysUser)
        .where(and(eq(sysUser.id, id), eq(sysUser.isDeleted, 0)))
        .limit(1)

      if (!updatedRows[0] || (updatedRows[0].deptId ?? null) !== deptId) {
        throw new AppError('common.notExist')
      }

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
      const pojo = await repo.getOneWithDept(req)
      if (!pojo) {
        throw new AppError('common.notExist')
      }
      return omitPassword(pojo) as SysUserDto
    },

    async getById(id: string): Promise<SysUserDto | null> {
      const pojo = await repo.getByIdWithDept(id)
      return omitPassword(pojo) as SysUserDto | null
    },

    /**
     * 只取「是否已设置过密码」这一状态。
     *
     * getById 会剔除 password，因此无法据此判断；这里单独查一次 password 列，
     * 既避免把密码哈希暴露给调用方，也便于个人中心与 setPassword 复用。
     */
    async getPasswordStatus(id: string): Promise<{ hasPassword: boolean } | null> {
      const rows = await ctx.db
        .select({ password: sysUser.password })
        .from(sysUser)
        .where(and(eq(sysUser.id, id), eq(sysUser.isDeleted, 0)))
        .limit(1)

      const row = rows[0]
      if (!row) return null

      return { hasPassword: !isPlaceholderPassword(row.password) }
    },

    async page(req: SysUserPageQueryDTO): Promise<OrmPageResp> {
      const { page, pageSize, ...dto } = req
      const result = await repo.pageWithDept(page, pageSize, dto)
      return {
        ...result,
        list: result.list.map(omitPassword)
      }
    },

    async list(dto: any): Promise<SysUserDto[]> {
      const result = await repo.listWithDept(dto)
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
      await rbacCache.invalidateUser(data.userId)

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
