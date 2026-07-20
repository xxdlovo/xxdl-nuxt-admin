//#server/system-ossConfig-router
import { router, crudPermissionProcedures } from '~~/server/trpc/init'
import { sysOssConfigService } from './SysOssConfigService'
import z from 'zod'
import { SysOssConfigAddSchema, SysOssConfigUpdateSchema, SysOssConfigQuerySchema, SysOssConfigPageQuerySchema } from "#shared/system/ossConfig";

const p = crudPermissionProcedures('system:ossConfig')

export const sysOssConfigRouter = router({
    create: p.add.input(SysOssConfigAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOssConfigService(ctx).create(input)
        }),
    remove: p.del.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysOssConfigService(ctx).remove(input)
        }),
    batchDelete: p.del.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysOssConfigService(ctx).batchRemove(input)
        }),
    update: p.edit.input(SysOssConfigUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOssConfigService(ctx).updateById(input.id, input)
        }),
    getOne: p.list.input(SysOssConfigQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysOssConfigService(ctx).getOne(input)
        }),
    getById: p.list.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysOssConfigService(ctx).getById(input)
        }),
    page: p.list.input(SysOssConfigPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysOssConfigService(ctx).page(input)
        })
})
