import { useLogger } from 'evlog'
import { sysUserRepo } from './SysUserRepo'
import { sysUserRoleRepo } from '#admin/server/sys-router/userRole/SysUserRoleRepo'
import { sysRoleRepo } from '#admin/server/sys-router/role/SysRoleRepo'
import type { Context } from '#admin/server/trpc/context'
import { AppError } from '#admin/server/utils/appError'
import type { OrmPageResp } from '#admin/server/utils/ApiResp'
import type {
  SysUserAddDTO,
  SysUserDto,
  SysUserPageQueryDTO,
  SysUserQueryDTO,
  SysUserRegisterDTO,
  SysUserResetPasswordDTO,
  SysUserUpdateDTO
} from '#admin/shared/system/user'
import type {
  SysUserRoleAssignedIdsQueryDTO,
  SysUserRoleAssignDTO
} from '#admin/shared/system/userRole'
import { randomUuid } from '#admin/shared/utils/uuid'
import { hashUserPassword, isPlaceholderPassword } from '#admin/server/utils/password'
import { sysDeptRepo } from '#admin/server/sys-router/dept/SysDeptRepo'
import { sysUserPostRepo } from '#admin/server/sys-router/userPost/SysUserPostRepo'
import { sysPostRepo } from '#admin/server/sys-router/post/SysPostRepo'
import { rbacCacheService } from '#admin/server/sys-router/storage/cache/RbacCacheService'
import { sysOnlineService } from '#admin/server/sys-router/online/SysOnlineService'
import { runUserOnboardHooks } from '#admin/server/hooks/userOnboard'
import { assertLastAdmin, assertNotSelf, isUsableAdmin } from '#admin/server/utils/adminGuard'

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
  const userPostRepo = sysUserPostRepo(ctx)
  const postRepo = sysPostRepo(ctx)
  const rbacCache = rbacCacheService()
  // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
  const log = useLogger(ctx.event, 'server/sys-router/user')

  /** 批量补齐用户的岗位 id / 岗位名，避免列表 N+1 查询。 */
  async function attachPosts<T extends { id?: string | null }>(users: T[]) {
    const userIds = users
      .map(user => user.id)
      .filter((id): id is string => Boolean(id))

    if (userIds.length === 0) {
      return users.map(user => ({ ...user, postIds: [], postNames: '' }))
    }

    let links: Array<{ userId: string, postId: string }> = []
    let posts: Array<{ id: string, name: string | null }> = []

    try {
      links = await userPostRepo.listByUserIds(userIds)
      const postIds = Array.from(new Set(links.map(link => link.postId)))
      posts = await postRepo.listByIds(postIds)
    }
    catch (error) {
      // P2 迁移尚未执行时，用户列表/详情不能被岗位表拖垮
      console.error('[User] post info load failed', error)
      return users.map(user => ({ ...user, postIds: [], postNames: '' }))
    }

    const nameMap = new Map(posts.map(post => [post.id, post.name]))
    const byUser = new Map<string, string[]>()

    for (const link of links) {
      const list = byUser.get(link.userId) ?? []
      list.push(link.postId)
      byUser.set(link.userId, list)
    }

    return users.map((user) => {
      const ids = byUser.get(user.id ?? '') ?? []
      return {
        ...user,
        postIds: ids,
        postNames: ids
          .map(id => nameMap.get(id))
          .filter((name): name is string => Boolean(name))
          .join(','),
      }
    })
  }

  return {
    async create(data: SysUserAddDTO): Promise<boolean> {
      const { postIds, ...values } = data
      const pojo = {
        ...values,
        id: randomUuid(),
        password: await hashUserPassword(data.password)
      }
      await repo.create(pojo)
      if (postIds !== undefined) {
        await userPostRepo.replaceUserPosts(pojo.id, postIds, ctx.user?.id ?? null)
      }
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
       * 触发业务域建档钩子（如电商层开通会员档案、钱包、邀请绑定）。
       *
       * 基座不认识任何具体业务：钩子由可选业务层在启动时注册，
       * 且失败**不回滚用户注册**（账号已经建好，档案可由 `member:backfill-profile`
       * 之类的补偿任务补齐），错误只记日志。
       */
      await runUserOnboardHooks(ctx, {
        userId,
        inviteCode: data.inviteCode ?? null,
        source: 'register',
        operatorId: userId
      })

      return true
    },

    async remove(id: string): Promise<boolean> {
      const target = await repo.getById(id)
      if (!target) {
        throw new AppError('common.notExist')
      }

      // 不能删自己；最后一个可用管理员也不能被删除，否则后台会彻底锁死。
      assertNotSelf(id, ctx.user?.id)
      if (isUsableAdmin(target)) {
        assertLastAdmin(await repo.countActiveAdmins([id]))
      }

      await repo.remove(id)
      await userPostRepo.removeByUserId(id, ctx.user?.id ?? null)
      await sysOnlineService(ctx).revokeUserSessions(id)
      await rbacCache.invalidateUser(id)
      log.info('user removed', { user: { action: 'remove', id } })
      return true
    },

    async batchRemove(ids: string[]): Promise<number> {
      const targets = await repo.listScopedByIds(ids)
      if (targets.length === 0) {
        return 0
      }

      for (const target of targets) {
        assertNotSelf(target.id, ctx.user?.id)
      }

      const removingAdminIds = targets
        .filter(isUsableAdmin)
        .map(target => target.id)

      if (removingAdminIds.length > 0) {
        assertLastAdmin(await repo.countActiveAdmins(removingAdminIds))
      }

      await repo.batchRemove(targets.map(target => target.id))
      await Promise.all(targets.map(async (target) => {
        await userPostRepo.removeByUserId(target.id, ctx.user?.id ?? null)
        await sysOnlineService(ctx).revokeUserSessions(target.id)
        await rbacCache.invalidateUser(target.id)
      }))
      log.info('user batch removed', { user: { action: 'batchRemove', count: targets.length } })
      return targets.length
    },

    async updateById(id: string, data: SysUserUpdateDTO): Promise<boolean> {
      const { id: _inputId, postIds, ...values } = data
      const deptId = normalizeDeptId(data.deptId)
      const current = await repo.getById(id)

      if (!current) {
        throw new AppError('common.notExist')
      }

      // 禁用账号前先确认：不是自己，且不会把最后一个可用管理员禁用掉。
      if (data.status !== undefined && data.status !== 1) {
        assertNotSelf(id, ctx.user?.id)
        if (isUsableAdmin(current)) {
          assertLastAdmin(await repo.countActiveAdmins([id]))
        }
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
      if (postIds !== undefined) {
        await userPostRepo.replaceUserPosts(id, postIds, ctx.user?.id ?? null)
      }
      if (data.status !== undefined) {
        await rbacCache.invalidateUser(id)
        // 禁用账号时撤销全部在线会话，避免已登录的浏览器继续操作
        if (data.status !== 1) {
          await sysOnlineService(ctx).revokeUserSessions(id)
        }
      }

      // 回读校验：确认部门确实写入成功（数据权限外的异常写入也会在这里暴露）
      if ((await repo.getDeptIdById(id) ?? null) !== deptId) {
        throw new AppError('common.notExist')
      }

      log.info('user updated', { user: { action: 'update', id } })
      return true
    },

    /**
     * Reset the user's password without checking the old one.
     *
     * options.exceptSessionId 用于本人改密：只踢掉其他会话，保留当前浏览器；
     * 管理员重置密码不传该参数，目标用户的全部会话都会失效。
     */
    async resetPassword(
      data: SysUserResetPasswordDTO,
      options?: { exceptSessionId?: string | null },
    ): Promise<boolean> {
      const password = await hashUserPassword(data.password)
      await repo.updatePasswordById(data.id, password)
      // 管理员重置密码后同时解锁，避免用户拿到新密码仍被锁在门外
      await repo.clearLoginFailure(data.id)
      // 改密后旧会话必须失效，否则泄露的会话可以继续使用旧密码登录态
      await sysOnlineService(ctx).revokeUserSessions(data.id, options)
      log.info('user password reset', { user: { action: 'resetPassword', id: data.id } })
      return true
    },

    /** 管理员手动解锁账号 */
    async unlock(id: string): Promise<boolean> {
      const user = await repo.getActiveById(id)
      if (!user) {
        throw new AppError('common.notExist')
      }

      await repo.clearLoginFailure(id)
      log.info('user unlocked', { user: { action: 'unlock', id } })
      return true
    },

    /**
     * 登录失败：失败次数 +1，达到阈值时锁定账号。
     * 返回 locked 与剩余次数，由 AuthService 决定抛哪个错误。
     */
    async registerLoginFailure(id: string, maxRetry: number, lockMinutes: number) {
      const failCount = await repo.incrementLoginFail(id)
      if (failCount >= maxRetry) {
        await repo.lockLogin(id, lockMinutes)
        log.info('user locked after login failures', { user: { action: 'lock', id, failCount } })
        return { locked: true, failCount, remaining: 0 }
      }

      return { locked: false, failCount, remaining: Math.max(maxRetry - failCount, 0) }
    },

    /** 清除锁定（例如锁定已过期后再次登录） */
    async clearLoginFailure(id: string): Promise<boolean> {
      await repo.clearLoginFailure(id)
      return true
    },

    /** 登录成功：更新最后登录时间/IP 并清空失败计数 */
    async markLoginSuccess(id: string, ip: string): Promise<boolean> {
      await repo.markLoginSuccess(id, ip)
      return true
    },

    async getOne(req: SysUserQueryDTO): Promise<SysUserDto> {
      const pojo = await repo.getOneWithDept(req)
      if (!pojo) {
        throw new AppError('common.notExist')
      }
      const [withPosts] = await attachPosts([pojo])
      log.info('user fetched', { user: { action: 'getOne' } })
      return omitPassword(withPosts!) as SysUserDto
    },

    async getById(id: string): Promise<SysUserDto | null> {
      const pojo = await repo.getByIdWithDept(id)
      log.info('user fetched', { user: { action: 'getById', id } })
      if (!pojo) {
        return null
      }
      const [withPosts] = await attachPosts([pojo])
      return omitPassword(withPosts!) as SysUserDto
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
      const listWithPosts = await attachPosts(result.list)
      log.info('user page queried', { user: { action: 'page', page, pageSize, total: result.total } })
      return {
        ...result,
        list: listWithPosts.map(omitPassword)
      }
    },

    async list(dto: any): Promise<SysUserDto[]> {
      const result = await repo.listWithDept(dto)
      const listWithPosts = await attachPosts(result)
      log.info('user listed', { user: { action: 'list', count: result.length } })
      return listWithPosts.map(omitPassword) as SysUserDto[]
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
      const enableIds = existingRows
        .filter(row => selectedSet.has(row.roleId))
        .map(row => row.id)
      const disableIds = existingRows
        .filter(row => row.isDeleted === 0 && !selectedSet.has(row.roleId))
        .map(row => row.id)
      const insertRoleIds = selectedRoleIds.filter(id => !existingRows.some(row => row.roleId === id))
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
