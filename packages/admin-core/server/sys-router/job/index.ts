import { z } from 'zod'
import { proc, router } from '#admin/server/trpc/init'
import {
    SysJobAddSchema,
    SysJobPageQuerySchema,
    SysJobQuerySchema,
    SysJobStatusSchema,
    SysJobUpdateSchema
} from '#admin/shared/system/job'
import { sysJobService } from './SysJobService'

const listProc = proc({ permission: 'system:job:list' })
const addProc = proc({ permission: 'system:job:add', repeatSubmit: true })
const editProc = proc({ permission: 'system:job:edit', repeatSubmit: true })
const delProc = proc({ permission: 'system:job:del' })
const runProc = proc({
    permission: 'system:job:run',
    repeatSubmit: true,
    rateLimit: { limit: 9, windowMs: 60_000, scope: 'job-run' }
})

export const sysJobRouter = router({
    create: addProc.input(SysJobAddSchema)
        .mutation(({ ctx, input }) => sysJobService(ctx).create(input)),
    remove: delProc.input(z.string())
        .mutation(({ ctx, input }) => sysJobService(ctx).remove(input)),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(({ ctx, input }) => sysJobService(ctx).batchRemove(input)),
    update: editProc.input(SysJobUpdateSchema)
        .mutation(({ ctx, input }) => sysJobService(ctx).updateById(input.id, input)),
    enable: editProc.input(SysJobStatusSchema)
        .mutation(({ ctx, input }) => sysJobService(ctx).enable(input.id)),
    disable: editProc.input(SysJobStatusSchema)
        .mutation(({ ctx, input }) => sysJobService(ctx).disable(input.id)),
    getOne: listProc.input(SysJobQuerySchema)
        .query(({ ctx, input }) => sysJobService(ctx).getOne(input)),
    getById: listProc.input(z.string())
        .query(({ ctx, input }) => sysJobService(ctx).getById(input)),
    list: listProc.input(SysJobQuerySchema)
        .query(({ ctx, input }) => sysJobService(ctx).list(input)),
    page: listProc.input(SysJobPageQuerySchema)
        .query(({ ctx, input }) => sysJobService(ctx).page(input)),
    availableHandlers: listProc
        .query(({ ctx }) => sysJobService(ctx).availableHandlers()),
    runNow: runProc.input(z.string().nonempty('form.id.required'))
        .mutation(async ({ input }) => {
            return runTask('sys-job:run', {
                payload: { jobId: input, triggerType: 'manual' }
            })
        })
})
