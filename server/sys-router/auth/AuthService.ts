import type { Context, AuthUser } from '#server/trpc/context'
import { sysMenuService } from '#server/sys-router/menu/SysMenuService'
import { sysRoleService } from '#server/sys-router/role/SysRoleService'
import { sysUserService } from '#server/sys-router/user/SysUserService'
import { sysConfigService } from '#server/sys-router/config/SysConfigService'
import { logRecorder } from '#server/sys-router/systemLog/LogRecorderService'
import { AppError } from '#server/utils/appError'
import { isPlaceholderPassword, verifyUserPassword } from '#server/utils/password'
import type { RbacFlatMenu, RbacMenu, RbacProfile } from '#shared/auth'
import { systemRegisterEnum } from '#shared/constants/business'
import type {
  SysUserChangePasswordDTO,
  SysUserProfileUpdateDTO,
  SysUserRegisterDTO,
  SysUserSetPasswordDTO
} from '#shared/system/user'
import { rbacCacheService } from '#server/sys-router/storage/cache/RbacCacheService'

function sortMenus(menus: RbacMenu[]) {
  menus.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  menus.forEach(menu => sortMenus(menu.children))
}

function buildMenuTree(flatMenus: RbacFlatMenu[]) {
  const nodes = new Map<string, RbacMenu>()
  const roots: RbacMenu[] = []

  for (const menu of flatMenus) {
    nodes.set(menu.id, { ...menu, children: [] })
  }

  for (const menu of nodes.values()) {
    const parent = menu.parentId ? nodes.get(menu.parentId) : null
    if (parent) {
      parent.children.push(menu)
    } else {
      roots.push(menu)
    }
  }

  sortMenus(roots)
  return roots
}

function uniqById<T extends { id: string }>(items: T[]) {
  const map = new Map<string, T>()
  items.forEach(item => map.set(item.id, item))
  return Array.from(map.values())
}

/**
 * 认证与账号自助服务。
 *
 * 控制层（auth/index.ts）只做「权限声明 + 入参 schema + 从会话取用户」，
 * 注册开关、账号密码校验、会话写入、登录日志、资料与密码修改规则都在这里。
 */
export function authService(ctx: Context) {
  const cache = rbacCacheService()
  const roleService = sysRoleService(ctx)
  const menuService = sysMenuService(ctx)
  return {
    /**
     * Build the current user's RBAC read model for frontend menus and permission checks.
     * Entity-specific queries stay in role/menu services; auth only assembles the profile.
     */
    async getRbacProfile(user: AuthUser): Promise<RbacProfile> {
      const roleItems = uniqById(await cache.getUserRoles(user.id, () => roleService.listEnabledByUserId(user.id)))
      const menus = user.isAdmin === 1
        ? await cache.getAdminMenus(() => menuService.listEnabledForAdmin())
        : uniqById((await Promise.all(roleItems.map(role => cache.getRoleMenus(role.code, () => menuService.listEnabledByRoleIds([role.id]))))).flat())

      const flatMenus = uniqById(menus)
      const menuTreeItems = flatMenus.filter(menu => menu.visible === 0 && menu.type !== 2)

      return {
        user,
        roles: roleItems,
        permissions: flatMenus.map(menu => menu.code),
        menus: buildMenuTree(menuTreeItems)
      }
    },

    /**
     * List permission codes for backend endpoint guards.
     * The result is flat and request-cached by the permission middleware.
     */
    async listPermissionCodes(user: AuthUser): Promise<string[]> {
      const roleItems = uniqById(await cache.getUserRoles(user.id, () => roleService.listEnabledByUserId(user.id)))
      const menus = user.isAdmin === 1
        ? await cache.getAdminMenus(() => menuService.listEnabledForAdmin())
        : uniqById((await Promise.all(roleItems.map(role => cache.getRoleMenus(role.code, () => menuService.listEnabledByRoleIds([role.id]))))).flat())

      return Array.from(new Set(menus.map(menu => menu.code)))
    },

    /** 注册：受系统配置里的注册开关控制 */
    async register(input: SysUserRegisterDTO) {
      const value = await sysConfigService(ctx).getValueByKey(systemRegisterEnum.key)

      if (value !== systemRegisterEnum.yes) {
        throw new AppError('auth.registerDisabled')
      }

      return await sysUserService(ctx).register(input)
    },

    /** 登录：账号密码校验 → 写会话 → 记登录日志（失败也记） */
    async login(username: string, password: string) {
      try {
        const user = await sysUserService(ctx).getLoginUserByUsername(username)

        if (!user || user.status !== 1) {
          throw new AppError('auth.userIsBlock')
        }

        const validPassword = await verifyUserPassword(user.password, password)

        if (!validPassword) {
          throw new AppError('auth.invalidCredentials')
        }

        const sessionUser = {
          id: user.id,
          username: user.username,
          email: user.email,
          nickname: user.nickname,
          avatar: user.avatar,
          phone: user.phone,
          gender: user.gender,
          deptId: user.deptId,
          isAdmin: user.isAdmin
        }

        await setUserSession(ctx.event, {
          user: sessionUser,
          loggedInAt: new Date().toISOString()
        })

        ctx.user = sessionUser
        await logRecorder(ctx).loginSuccess()

        return sessionUser
      }
      catch (error) {
        await logRecorder(ctx).loginFailure(username, 'login failure', error)
        throw error
      }
    },

    async logout() {
      await clearUserSession(ctx.event)

      return true
    },

    async me() {
      const session = await getUserSession(ctx.event)

      return session.user ?? null
    },

    /** 当前登录用户的资料（附带「是否已设置过密码」状态位） */
    async myProfile(user: AuthUser) {
      const current = await sysUserService(ctx).getById(user.id)
      // getById 已剔除 password，这里额外补一个状态位：
      // 前端据此决定密码表单是「设置新密码」（无需原密码）
      // 还是「修改密码」（必须输入原密码）。
      const passwordStatus = await sysUserService(ctx).getPasswordStatus(user.id)

      return {
        ...(current ?? {}),
        hasPassword: passwordStatus?.hasPassword ?? true
      }
    },

    /** 更新自己的资料，并同步刷新会话里的用户信息 */
    async updateProfile(user: AuthUser, input: SysUserProfileUpdateDTO) {
      const currentUser = await sysUserService(ctx).getById(user.id)
      if (!currentUser?.id || !currentUser.username) {
        throw new AppError('common.notExist')
      }

      await sysUserService(ctx).updateById(user.id, {
        id: user.id,
        username: currentUser.username,
        email: input.email,
        nickname: input.nickname || null,
        avatar: input.avatar || null,
        phone: input.phone || null,
        gender: input.gender ?? null,
        deptId: currentUser.deptId ?? null,
        status: currentUser.status ?? 1,
        remark: input.remark || null
      })

      const nextUser = {
        id: user.id,
        username: currentUser.username,
        email: input.email,
        nickname: input.nickname || null,
        avatar: input.avatar || null,
        phone: input.phone || null,
        gender: input.gender ?? null,
        deptId: currentUser.deptId ?? null,
        isAdmin: currentUser.isAdmin ?? user.isAdmin ?? null
      }

      await setUserSession(ctx.event, {
        user: nextUser,
        loggedInAt: ctx.session.loggedInAt
      })

      ctx.user = nextUser
      return nextUser
    },

    /** 修改密码：必须校验原密码 */
    async changePassword(user: AuthUser, input: SysUserChangePasswordDTO) {
      const current = await sysUserService(ctx).getLoginUserByUsername(user.username)
      if (!current || current.id !== user.id) {
        throw new AppError('common.notExist')
      }

      const validPassword = await verifyUserPassword(current.password, input.oldPassword)
      if (!validPassword) {
        throw new AppError('auth.invalidCredentials')
      }

      return await sysUserService(ctx).resetPassword({
        id: user.id,
        password: input.password,
        confirmPassword: input.confirmPassword
      })
    },

    /**
     * 设置 / 修改密码。
     *
     * 行为取决于用户是否已经设置过密码（由 sys_user.password 是否为占位标记判断）：
     * - 从未设置过（OAuth 建号用户）：直接设置新密码，无需原密码 —— 库中的占位标记
     *   对用户不可知，要求原密码没有意义；
     * - 已设置过真实密码：必须提供并校验原密码，恢复原有的修改密码保护。
     *
     * 该校验放在服务端而不是依赖前端分支：否则任何登录用户都能直接调用本接口
     * 绕过原密码校验，等于废掉原有保护。
     */
    async setPassword(user: AuthUser, input: SysUserSetPasswordDTO) {
      const current = await sysUserService(ctx).getLoginUserByUsername(user.username)
      if (!current || current.id !== user.id) {
        throw new AppError('common.notExist')
      }

      // 已设置过密码 → 必须校验原密码
      if (!isPlaceholderPassword(current.password)) {
        if (!input.oldPassword) {
          throw new AppError('auth.oldPasswordRequired')
        }

        const validPassword = await verifyUserPassword(current.password, input.oldPassword)
        if (!validPassword) {
          throw new AppError('auth.invalidCredentials')
        }
      }

      return await sysUserService(ctx).resetPassword({
        id: user.id,
        password: input.password,
        confirmPassword: input.confirmPassword
      })
    }
  }
}
