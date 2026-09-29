import { z } from 'zod'
import { proc, router } from '~~/server/trpc/init'
import { SysJobLogPageQuerySchema } from '#shared/system/jobLog'
import { sysJobLogService } from './SysJobLogService'

const listProc = proc({ permission: 'system:jobLog:list' })
const delProc = proc({ permission: 'system:jobLog:del' })

export const sysJobLogRouter = router({
    remove: delProc.input(z.string())
        .mutation(({ ctx, input }) => sysJobLogService(ctx).remove(input)),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(({ ctx, input }) => sysJobLogService(ctx).batchRemove(input)),
    getById: listProc.input(z.string())
        .query(({ ctx, input }) => sysJobLogService(ctx).getById(input)),
    page: listProc.input(SysJobLogPageQuerySchema)
        .query(({ ctx, input }) => sysJobLogService(ctx).page(input))
})
