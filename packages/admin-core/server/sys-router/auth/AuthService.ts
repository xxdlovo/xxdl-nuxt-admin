import { useLogger } from 'evlog'
import { randomUUID } from 'node:crypto'
import type { Context, AuthUser } from '#admin/server/trpc/context'
import { sysMenuService } from '#admin/server/sys-router/menu/SysMenuService'
import { sysRoleService } from '#admin/server/sys-router/role/SysRoleService'
import { sysUserService } from '#admin/server/sys-router/user/SysUserService'
import { sysConfigService } from '#admin/server/sys-router/config/SysConfigService'
import { sysUserSessionRepo } from '#admin/server/sys-router/online/SysUserSessionRepo'
import { logRecorder } from '#admin/server/sys-router/systemLog/LogRecorderService'
import { AppError } from '#admin/server/utils/appError'
import { isPlaceholderPassword, verifyUserPassword } from '#admin/server/utils/password'
import { clearCaptcha, verifyCaptcha } from '#admin/server/utils/captcha'
import { getRequestInfo } from '#admin/server/utils/requestInfo'
import { cleanupExpiredSessions, invalidateSessionCache } from '#admin/server/utils/sessionGuard'
import { clearRememberedLogin, setRememberedLogin } from '#admin/server/utils/rememberedLogin'
import type { RbacFlatMenu, RbacMenu, RbacProfile } from '#admin/shared/auth'
import {
  systemCaptchaEnum,
  systemLoginSecurityEnum,
  systemRegisterEnum,
} from '#admin/shared/constants/business'
import type {
  SysUserChangePasswordDTO,
  SysUserProfileUpdateDTO,
  SysUserRegisterDTO,
  SysUserSetPasswordDTO,
} from '#admin/shared/system/user'
import { rbacCacheService } from '#admin/server/sys-router/storage/cache/RbacCacheService'

/** 登录接口的可选参数 */
export type AuthLoginOptions = {
  /** 图形验证码；开启验证码时必填 */
  captchaCode?: string | null
  /** 记住我：为 true 时会话 Cookie 保留 7 天 */
  rememberMe?: boolean
}

/** 会话 / 记住我的最长有效期（秒） */
const REMEMBER_ME_MAX_AGE = 7 * 24 * 60 * 60

function toPositiveInt(value: string | null | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

function getLockedMinutes(lockedUntil?: string | null) {
  if (!lockedUntil) {
    return 0
  }

  const time = new Date(lockedUntil).getTime()
  if (!Number.isFinite(time)) {
    return 0
  }

  return Math.max(0, Math.ceil((time - Date.now()) / 60000))
}

/** MySQL DATETIME / timestamp(mode: 'string') 需要的本地时间格式 */
function formatDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

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
  // evlog 宽事件：只记动作与标识（id / 条数），不打印完整入参出参
  const log = useLogger(ctx.event, 'server/sys-router/auth')

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

      // authMiddleware 已在本请求内解析过就直接复用，保证 ctx.entitlements 与
      // profile.entitlements 是同一份对象；脱离中间件调用时（如内部脚本）才自己解析。
      // resolveEntitlements 走 server/utils 自动导入，安装 trade 层时按会员等级解析。
      const entitlements = ctx.entitlements ?? await resolveEntitlements(ctx)
      ctx.entitlements = entitlements

      const profile = {
        user,
        roles: roleItems,
        permissions: flatMenus.map(menu => menu.code),
        menus: buildMenuTree(menuTreeItems),
        entitlements
      }
      log.info('auth rbac profile fetched', {
        auth: { action: 'getRbacProfile', count: profile.permissions.length }
      })

      return profile
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

      const codes = Array.from(new Set(menus.map(menu => menu.code)))
      log.info('auth permission codes listed', { auth: { action: 'listPermissionCodes', count: codes.length } })

      return codes
    },

    /** 注册：受系统配置里的注册开关控制 */
    async register(input: SysUserRegisterDTO) {
      const value = await sysConfigService(ctx).getValueByKey(systemRegisterEnum.key)

      if (value !== systemRegisterEnum.yes) {
        throw new AppError('auth.registerDisabled')
      }

      const result = await sysUserService(ctx).register(input)
      log.info('auth registered', { auth: { action: 'register' } })

      return result
    },

    /**
     * 登录：验证码 → 锁定检查 → 账号密码校验 → 写会话 → 记登录日志（失败也记）
     *
     * 安全约定：
     * - 验证码开启时先校验验证码，避免直接对密码做暴力尝试；
     * - 账号不存在与密码错误返回同一文案，避免枚举账号；
     * - 锁定中的账号即使密码正确也拒绝，管理员可在用户管理里解锁。
     */
    async login(username: string, password: string, options: AuthLoginOptions = {}) {
      const configService = sysConfigService(ctx)
      const captchaEnabled = (await configService.getValueByKey(systemCaptchaEnum.key)) === systemCaptchaEnum.enabled
      const maxRetry = toPositiveInt(
        await configService.getValueByKey(systemLoginSecurityEnum.maxRetryKey),
        systemLoginSecurityEnum.defaultMaxRetry
      )
      const lockMinutes = toPositiveInt(
        await configService.getValueByKey(systemLoginSecurityEnum.lockMinutesKey),
        systemLoginSecurityEnum.defaultLockMinutes
      )

      try {
        if (captchaEnabled) {
          if (!verifyCaptcha(ctx.event, options.captchaCode)) {
            throw new AppError('auth.captchaInvalid')
          }
        }
        else {
          // 关闭验证码时清掉历史 Cookie，避免下一次开启后误用旧答案
          clearCaptcha(ctx.event)
        }

        const user = await sysUserService(ctx).getLoginUserByUsername(username)

        if (!user || user.status !== 1) {
          throw new AppError('auth.invalidCredentials')
        }

        // 锁定已过期：清空计数，允许重新尝试；仍在锁定期：直接拒绝
        if (user.lockedUntil) {
          const remainingMinutes = getLockedMinutes(user.lockedUntil)
          if (remainingMinutes > 0) {
            throw new AppError('auth.accountLocked', { message: String(remainingMinutes) })
          }

          await sysUserService(ctx).clearLoginFailure(user.id)
        }

        const validPassword = await verifyUserPassword(user.password, password)

        if (!validPassword) {
          const result = await sysUserService(ctx).registerLoginFailure(user.id, maxRetry, lockMinutes)

          if (result.locked) {
            throw new AppError('auth.accountLocked', { message: String(lockMinutes) })
          }

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

        const requestInfo = getRequestInfo(ctx.event)
        const sessionId = randomUUID()
        const expiresAt = formatDateTime(new Date(Date.now() + REMEMBER_ME_MAX_AGE * 1000))

        await sysUserService(ctx).markLoginSuccess(user.id, requestInfo.ip)
        await sysUserSessionRepo(ctx).create({
          id: sessionId,
          userId: user.id,
          username: user.username,
          ip: requestInfo.ip,
          userAgent: requestInfo.userAgent,
          browser: requestInfo.browser,
          os: requestInfo.os,
          expiresAt
        })

        await setUserSession(ctx.event, {
          user: sessionUser,
          loggedInAt: new Date().toISOString(),
          sessionId
        }, options.rememberMe ? { maxAge: REMEMBER_ME_MAX_AGE } : undefined)

        // “记住我”：密码用 HttpOnly + AES-GCM 凭据保存，登录页按需回填。
        if (options.rememberMe) {
          setRememberedLogin(ctx.event, {
            username: user.username,
            password
          })
        }
        else {
          clearRememberedLogin(ctx.event)
        }

        ctx.user = sessionUser
        clearCaptcha(ctx.event)
        await logRecorder(ctx).loginSuccess()
        log.info('auth logged in', { auth: { action: 'login', id: user.id } })

        // 清理 7 天前的过期会话；失败只打日志，不影响登录
        void cleanupExpiredSessions()

        return sessionUser
      }
      catch (error) {
        await logRecorder(ctx).loginFailure(username, 'login failure', error)
        throw error
      }
    },

    async logout() {
      const sessionId = ctx.session?.sessionId
      if (sessionId) {
        await sysUserSessionRepo(ctx).revoke(sessionId, ctx.user?.id ?? null)
        invalidateSessionCache(sessionId)
      }

      await clearUserSession(ctx.event)
      clearRememberedLogin(ctx.event)
      log.info('auth logged out', { auth: { action: 'logout' } })

      return true
    },

    async me() {
      // 不要直接再读 getUserSession：被强退的会话 Cookie 仍然存在，
      // 以 context 中经过 sessionGuard 校验的 user 为准。
      log.info('auth current user fetched', { auth: { action: 'me' } })
      return ctx.user
    },

    /** 当前登录用户的资料（附带「是否已设置过密码」状态位） */
    async myProfile(user: AuthUser) {
      const current = await sysUserService(ctx).getById(user.id)
      // getById 已剔除 password，这里额外补一个状态位：
      // 前端据此决定密码表单是「设置新密码」（无需原密码）
      // 还是「修改密码」（必须输入原密码）。
      const passwordStatus = await sysUserService(ctx).getPasswordStatus(user.id)

      const profile = {
        ...(current ?? {}),
        hasPassword: passwordStatus?.hasPassword ?? true
      }
      log.info('auth profile fetched', { auth: { action: 'myProfile', id: user.id } })

      return profile
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
        loggedInAt: ctx.session.loggedInAt,
        sessionId: ctx.session.sessionId
      })

      ctx.user = nextUser
      log.info('auth profile updated', { auth: { action: 'updateProfile', id: user.id } })

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

      const result = await sysUserService(ctx).resetPassword({
        id: user.id,
        password: input.password,
        confirmPassword: input.confirmPassword
      }, {
        // 本人改密：保留当前浏览器会话，踢掉其他设备上的旧会话
        exceptSessionId: ctx.session?.sessionId
      })
      log.info('auth password updated', { auth: { action: 'changePassword', id: user.id } })
      clearRememberedLogin(ctx.event)

      return result
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

      const result = await sysUserService(ctx).resetPassword({
        id: user.id,
        password: input.password,
        confirmPassword: input.confirmPassword
      }, {
        // 本人设置/修改密码：保留当前浏览器会话，踢掉其他设备上的旧会话
        exceptSessionId: ctx.session?.sessionId
      })
      log.info('auth password set', { auth: { action: 'setPassword', id: user.id } })
      clearRememberedLogin(ctx.event)

      return result
    }
  }
}
