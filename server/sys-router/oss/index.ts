//#server/system-oss-router
import { router, crudPermissionProcedures } from '~~/server/trpc/init'
import { sysOssService } from './SysOssService'
import z from 'zod'
import { SysOssAddSchema, SysOssUpdateSchema, SysOssQuerySchema, SysOssPageQuerySchema } from "#shared/system/oss";

const p = crudPermissionProcedures('system:oss')

export const sysOssRouter = router({
    create: p.add.input(SysOssAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOssService(ctx).create(input)
        }),
    remove: p.del.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysOssService(ctx).remove(input)
        }),
    batchDelete: p.del.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysOssService(ctx).batchRemove(input)
        }),
    update: p.edit.input(SysOssUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOssService(ctx).updateById(input.id, input)
        }),
    getOne: p.list.input(SysOssQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysOssService(ctx).getOne(input)
        }),
    getById: p.list.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysOssService(ctx).getById(input)
        }),
    page: p.list.input(SysOssPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysOssService(ctx).page(input)
        }),
    uploadConfigs: p.add
        .query(async ({ ctx }) => {
            return sysOssService(ctx).listUploadConfigs()
        })
})
