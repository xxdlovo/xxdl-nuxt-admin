import { AppError } from './appError'

/**
 * 管理员 / 系统角色安全守卫。
 *
 * 这些规则决定“后台会不会被操作到没人能登录”，因此集中放在这里：
 * - 用户删除、批量删除、禁用前，确认系统里还留有可用的管理员；
 * - 系统内置角色不允许删除、改编码、停用或改数据范围；
 * - 当前登录账号不能被自己删除/禁用。
 *
 * 判断函数保持纯函数，方便单测；抛错统一走 AppError 的 i18n key。
 */

export type AdminGuardUser = {
    isAdmin?: number | null
    status?: number | null
}

export type SystemRoleGuardRole = {
    isSystem?: number | null
    code?: string | null
    status?: number | null
    dataScope?: string | null
}

export type SystemRoleGuardChanges = {
    code?: string | null
    status?: number | null
    dataScope?: string | null
}

/** 该用户当前是否算“可用管理员”：管理员标记 + 启用状态。 */
export function isUsableAdmin(user: AdminGuardUser) {
    return user.isAdmin === 1 && user.status === 1
}

/** 当前登录人不能删除/禁用自己，避免误操作把自己锁在门外。 */
export function assertNotSelf(targetUserId: string, currentUserId?: string | null) {
    if (currentUserId && targetUserId === currentUserId) {
        throw new AppError('system.cannotOperateSelf')
    }
}

/** 本次操作后必须至少保留一个可用管理员。 */
export function assertLastAdmin(remainingActiveAdmins: number) {
    if (remainingActiveAdmins <= 0) {
        throw new AppError('system.lastAdmin')
    }
}

/** 系统内置角色禁止删除。 */
export function assertSystemRoleDeletable(role: SystemRoleGuardRole) {
    if (role.isSystem === 1) {
        throw new AppError('system.systemRoleProtected')
    }
}

/**
 * 系统内置角色只允许改名称/描述/排序/备注。
 *
 * code 是权限与缓存 key 的一部分，status 决定角色是否生效，dataScope 决定
 * 数据边界；这三项改动会让内置角色偏离初始化语义，因此统一拒绝。
 */
export function assertSystemRoleProtected(
    role: SystemRoleGuardRole,
    changes: SystemRoleGuardChanges,
) {
    if (role.isSystem !== 1) {
        return
    }

    if (changes.code && changes.code !== role.code) {
        throw new AppError('system.systemRoleProtected')
    }

    if (changes.status !== undefined && changes.status !== 1) {
        throw new AppError('system.systemRoleProtected')
    }

    if (changes.dataScope && changes.dataScope !== role.dataScope) {
        throw new AppError('system.systemRoleProtected')
    }
}
