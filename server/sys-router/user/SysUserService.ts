import { useLogger } from 'evlog'
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
import { sysDeptRepo } from '#server/sys-router/dept/SysDeptRepo'
import { rbacCacheService } from '#server/sys-router/storage/cache/RbacCacheService'
import { memberService } from '#server/trade-router/domain/member/MemberService'

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
  const deptRepo = sysDeptRepo(ctx)
  const userRoleRepo = sysUserRoleRepo(ctx)
  const roleRepo = sysRoleRepo(ctx)
  const rbacCache = rbacCacheService()
  // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
  const log = useLogger(ctx.event, 'server/sys-router/user')

  return {
    async create(data: SysUserAddDTO): Promise<boolean> {
      const pojo = {
        ...data,
        id: randomUuid(),
        password: await hashUserPassword(data.password)
      }
      await repo.create(pojo)
      log.info('user created', { user: { action: 'create', id: pojo.id } })
      return true
    },

    async register(data: SysUserRegisterDTO): Promise<boolean> {
      if (await repo.existsByUsername(data.username)) {
        throw new AppError('auth.usernameExists')
      }

      if (await repo.existsByPhone(data.phone)) {
        throw new AppError('auth.phoneExists')
      }

      const userId = randomUuid()

      await repo.create({
        id: userId,
        username: data.username,
        password: await hashUserPassword(data.password),
        email: `${data.username}@registered.local`,
        nickname: data.username,
        phone: data.phone,
        gender: 0,
        isAdmin: 0,
        status: 1
      })
      log.info('user registered', { user: { action: 'register', id: userId } })

      /**
       * 注册即开会员档案（含注册赠金与邀请绑定）。
       *
       * 会员域失败**不回滚用户注册**：用户已经建好，档案可以由
       * `member:backfill-profile` 任务补齐，避免因为赠金配置等问题挡注册。
       * 失败原因写入日志，便于排查。
       */
      try {
        await memberService(ctx.db).onboard({
          userId,
          inviteCode: data.inviteCode ?? null,
          source: 'register',
          operatorId: userId
        })
      } catch (error) {
        console.error(`[member] 注册后开通会员档案失败 userId=${userId}`, error)
      }

      return true
    },

    async remove(id: string): Promise<boolean> {
      await repo.remove(id)
      await rbacCache.invalidateUser(id)
      log.info('user removed', { user: { action: 'remove', id } })
      return true
    },

    async batchRemove(ids: string[]): Promise<number> {
      await repo.batchRemove(ids)
      await Promise.all(ids.map(id => rbacCache.invalidateUser(id)))
      log.info('user batch removed', { user: { action: 'batchRemove', count: ids.length } })
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
        if (!(await deptRepo.existsActiveById(deptId))) {
          throw new AppError('common.notExist')
        }
      }

      await repo.updateById(id, {
        ...values,
        deptId
      })
      if (data.status !== undefined) await rbacCache.invalidateUser(id)

      // 回读校验：确认部门确实写入成功（数据权限外的异常写入也会在这里暴露）
      if ((await repo.getDeptIdById(id) ?? null) !== deptId) {
        throw new AppError('common.notExist')
      }

      log.info('user updated', { user: { action: 'update', id } })
      return true
    },

    /**
     * Reset the user's password without checking the old one.
     */
    async resetPassword(data: SysUserResetPasswordDTO): Promise<boolean> {
      const password = await hashUserPassword(data.password)
      await repo.updatePasswordById(data.id, password)
      log.info('user password reset', { user: { action: 'resetPassword', id: data.id } })
      return true
    },

    async getOne(req: SysUserQueryDTO): Promise<SysUserDto> {
      const pojo = await repo.getOneWithDept(req)
      if (!pojo) {
        throw new AppError('common.notExist')
      }
      log.info('user fetched', { user: { action: 'getOne' } })
      return omitPassword(pojo) as SysUserDto
    },

    async getById(id: string): Promise<SysUserDto | null> {
      const pojo = await repo.getByIdWithDept(id)
      log.info('user fetched', { user: { action: 'getById', id } })
      return omitPassword(pojo) as SysUserDto | null
    },

    /**
     * 只取「是否已设置过密码」这一状态。
     *
     * getById 会剔除 password，因此无法据此判断；这里单独查一次 password 列，
     * 既避免把密码哈希暴露给调用方，也便于个人中心与 setPassword 复用。
     */
    async getPasswordStatus(id: string): Promise<{ hasPassword: boolean } | null> {
      const password = await repo.getPasswordById(id)
      log.info('user password status fetched', { user: { action: 'getPasswordStatus', id } })

      if (password === null) return null

      return { hasPassword: !isPlaceholderPassword(password) }
    },

    async page(req: SysUserPageQueryDTO): Promise<OrmPageResp> {
      const { page, pageSize, ...dto } = req
      const result = await repo.pageWithDept(page, pageSize, dto)
      log.info('user page queried', { user: { action: 'page', page, pageSize, total: result.total } })
      return {
        ...result,
        list: result.list.map(omitPassword)
      }
    },

    async list(dto: any): Promise<SysUserDto[]> {
      const result = await repo.listWithDept(dto)
      log.info('user listed', { user: { action: 'list', count: result.length } })
      return result.map(omitPassword) as SysUserDto[]
    },

    /**
     * Read the role IDs already linked to a user for the edit form.
     */
    async listAssignedRoleIds(req: SysUserRoleAssignedIdsQueryDTO): Promise<string[]> {
      const ids = await userRoleRepo.listAssignedRoleIds(req)
      log.info('user assigned role ids listed', { user: { action: 'listAssignedRoleIds', count: ids.length } })
      return ids
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

      log.info('user roles assigned', { user: { action: 'assignRoles', id: data.userId } })
      return true
    },

    async getLoginUserByUsername(username: string) {
      const loginUser = await repo.getLoginUserByUsername(username)
      log.info('user login profile fetched', { user: { action: 'getLoginUserByUsername' } })
      return loginUser
    }
  }
}
