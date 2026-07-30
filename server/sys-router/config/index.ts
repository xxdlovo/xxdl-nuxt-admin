import z from 'zod'
import { SysConfigAddSchema, SysConfigPageQuerySchema, SysConfigQuerySchema, SysConfigUpdateSchema } from '#shared/system/config'
import { crudPermissionProcedures, publicProcedure, router } from '~~/server/trpc/init'
import { sysConfigService } from './SysConfigService'

const p = crudPermissionProcedures('system:config')

export const sysConfigRouter = router({
  create: p.add.input(SysConfigAddSchema)
    .mutation(({ ctx, input }) => sysConfigService(ctx).create(input)),
  remove: p.del.input(z.string())
    .mutation(({ ctx, input }) => sysConfigService(ctx).remove(input)),
  batchDelete: p.del.input(z.array(z.string()))
    .mutation(({ ctx, input }) => sysConfigService(ctx).batchRemove(input)),
  update: p.edit.input(SysConfigUpdateSchema)
    .mutation(({ ctx, input }) => sysConfigService(ctx).updateById(input.id, input)),
  getOne: p.list.input(SysConfigQuerySchema)
    .query(({ ctx, input }) => sysConfigService(ctx).getOne(input)),
  getById: p.list.input(z.string())
    .query(({ ctx, input }) => sysConfigService(ctx).getById(input)),
  getValueByKey: publicProcedure.input(z.string().min(1, 'form.required'))
    .query(({ ctx, input }) => sysConfigService(ctx).getValueByKey(input)),
  page: p.list.input(SysConfigPageQuerySchema)
    .query(({ ctx, input }) => sysConfigService(ctx).page(input))
})
