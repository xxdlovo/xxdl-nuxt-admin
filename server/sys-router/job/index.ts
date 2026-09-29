import { z } from 'zod'
import { proc, router } from '~~/server/trpc/init'
import {
    SysJobAddSchema,
    SysJobPageQuerySchema,
    SysJobQuerySchema,
    SysJobStatusSchema,
    SysJobUpdateSchema
} from '#shared/system/job'
import { sysJobService } from './SysJobService'

const listProc = proc({ permission: 'system:job:list' })
const addProc = proc({ permission: 'system:job:add' })
const editProc = proc({ permission: 'system:job:edit' })
const delProc = proc({ permission: 'system:job:del' })

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
    runNow: proc({ permission: 'system:job:run' }).input(z.string().nonempty('form.id.required'))
        .mutation(async ({ input }) => {
            return runTask('sys-job:run', {
                payload: { jobId: input, triggerType: 'manual' }
            })
        })
})
