import { router, proc } from '#admin/server/trpc/init'
import {
    SysOnlineBatchForceLogoutSchema,
    SysOnlineForceLogoutSchema,
    SysOnlinePageQuerySchema,
} from '#admin/shared/system/online'
import { sysOnlineService } from './SysOnlineService'

const listProc = proc({ permission: 'system:online:list' })
const forceProc = proc({ permission: 'system:online:forceLogout' })

export const sysOnlineRouter = router({
    page: listProc.input(SysOnlinePageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysOnlineService(ctx).page(input)
        }),

    forceLogout: forceProc.input(SysOnlineForceLogoutSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOnlineService(ctx).forceLogout(input.sessionId)
        }),

    batchForceLogout: forceProc.input(SysOnlineBatchForceLogoutSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOnlineService(ctx).batchForceLogout(input)
        }),
})
