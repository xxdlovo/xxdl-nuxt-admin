import { useLogger } from 'evlog'
import type { Context } from '#admin/server/trpc/context'
import type { SysOnlinePageQueryDTO } from '#admin/shared/system/online'
import type { OrmPageResp } from '#admin/server/utils/ApiResp'
import { AppError } from '#admin/server/utils/appError'
import { invalidateSessionCache } from '#admin/server/utils/sessionGuard'
import { sysUserSessionRepo } from './SysUserSessionRepo'

export function sysOnlineService(ctx: Context) {
    const repo = sysUserSessionRepo(ctx)
    const log = useLogger(ctx.event, 'server/sys-router/online')

    return {
        async page(input: SysOnlinePageQueryDTO): Promise<OrmPageResp> {
            const { page, pageSize, username, ip } = input
            const result = await repo.page(page, pageSize, { username, ip })
            log.info('online sessions queried', { online: { action: 'page', page, pageSize, total: result.total } })
            return result
        },

        async forceLogout(sessionId: string): Promise<boolean> {
            const session = await repo.getById(sessionId)
            if (!session) {
                throw new AppError('common.notExist')
            }

            await repo.revoke(sessionId, ctx.user?.id)
            invalidateSessionCache(sessionId)
            log.info('online session revoked', { online: { action: 'forceLogout', sessionId } })
            return true
        },

        async batchForceLogout(sessionIds: string[]): Promise<number> {
            const ids = Array.from(new Set(sessionIds.filter(Boolean)))
            if (ids.length === 0) {
                return 0
            }

            await repo.revokeBatch(ids, ctx.user?.id)
            ids.forEach(invalidateSessionCache)
            log.info('online sessions batch revoked', { online: { action: 'batchForceLogout', count: ids.length } })
            return ids.length
        },

        /** 用户被禁用/删除时调用；不抛错，避免影响主流程。 */
        async revokeUserSessions(userId: string) {
            const sessionIds = await repo.revokeByUserId(userId, ctx.user?.id)
            sessionIds.forEach(invalidateSessionCache)
            log.info('user sessions revoked', { online: { action: 'revokeUserSessions', userId, count: sessionIds.length } })
        },
    }
}
