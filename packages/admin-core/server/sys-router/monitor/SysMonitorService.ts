import type { MonitorOverview } from '#admin/shared/system/monitor'
import { collectServerMonitor } from '#admin/server/utils/systemMonitor'
import { sysStorageService } from '#admin/server/sys-router/storage/SysStorageService'
import { getDbPoolStats } from '#admin/server/drizzle/db'

export function sysMonitorService() {
    return {
        async overview(): Promise<MonitorOverview> {
            const [server, cache] = await Promise.all([
                collectServerMonitor(),
                sysStorageService().cacheOverview(),
            ])

            return {
                server,
                cache,
                pool: getDbPoolStats(),
                sampledAt: new Date().toISOString(),
            }
        },
    }
}
