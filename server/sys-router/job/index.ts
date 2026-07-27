import {z} from 'zod'
import {crudPermissionProcedures, permissionProcedure, router} from '~~/server/trpc/init'
import {
    SysJobAddSchema,
    SysJobPageQuerySchema,
    SysJobQuerySchema,
    SysJobStatusSchema,
    SysJobUpdateSchema
} from '#shared/system/job'
import {sysJobService} from './SysJobService'

const p = crudPermissionProcedures('system:job')

export const sysJobRouter = router({
    create: p.add.input(SysJobAddSchema).mutation(({ctx, input}) => sysJobService(ctx).create(input)),
    remove: p.del.input(z.string()).mutation(({ctx, input}) => sysJobService(ctx).remove(input)),
    batchDelete: p.del.input(z.array(z.string())).mutation(({ctx, input}) => sysJobService(ctx).batchRemove(input)),
    update: p.edit.input(SysJobUpdateSchema).mutation(({ctx, input}) => sysJobService(ctx).updateById(input.id, input)),
    enable: p.edit.input(SysJobStatusSchema).mutation(({ctx, input}) => sysJobService(ctx).enable(input.id)),
    disable: p.edit.input(SysJobStatusSchema).mutation(({ctx, input}) => sysJobService(ctx).disable(input.id)),
    getOne: p.list.input(SysJobQuerySchema).query(({ctx, input}) => sysJobService(ctx).getOne(input)),
    getById: p.list.input(z.string()).query(({ctx, input}) => sysJobService(ctx).getById(input)),
    list: p.list.input(SysJobQuerySchema).query(({ctx, input}) => sysJobService(ctx).list(input)),
    page: p.list.input(SysJobPageQuerySchema).query(({ctx, input}) => sysJobService(ctx).page(input)),
    availableHandlers: p.list.query(({ctx}) => sysJobService(ctx).availableHandlers()),
    runNow: permissionProcedure('system:job:run')
        .input(z.string().nonempty('form.id.required'))
        .mutation(async ({input}) => {
            return runTask('sys-job:run', {
                payload: {jobId: input, triggerType: 'manual'}
            })
        })
})
