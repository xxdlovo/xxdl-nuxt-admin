import { router, proc } from '#admin/server/trpc/init'
import { sysMonitorService } from './SysMonitorService'

const listProc = proc({ permission: 'system:monitor:list', dataScope: false })

export const sysMonitorRouter = router({
    overview: listProc
        .query(async () => {
            return sysMonitorService().overview()
        }),
})
