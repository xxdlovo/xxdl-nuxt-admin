import { z } from 'zod'
import { crudPermissionProcedures, router } from '~~/server/trpc/init'
import { SysJobLogPageQuerySchema } from '#shared/system/jobLog'
import { sysJobLogService } from './SysJobLogService'

const p = crudPermissionProcedures('system:jobLog')

export const sysJobLogRouter = router({
  remove: p.del.input(z.string()).mutation(({ ctx, input }) => sysJobLogService(ctx).remove(input)),
  batchDelete: p.del.input(z.array(z.string())).mutation(({ ctx, input }) => sysJobLogService(ctx).batchRemove(input)),
  getById: p.list.input(z.string()).query(({ ctx, input }) => sysJobLogService(ctx).getById(input)),
  page: p.list.input(SysJobLogPageQuerySchema).query(({ ctx, input }) => sysJobLogService(ctx).page(input))
})
