//#server/sys-router/oss
import { router, proc } from '~~/server/trpc/init'
import { sysOssService } from './SysOssService'
import z from 'zod'
import { SysOssAddSchema, SysOssUpdateSchema, SysOssQuerySchema, SysOssPageQuerySchema } from '#shared/system/oss'

const listProc = proc({ permission: 'system:oss:list' })
const addProc = proc({ permission: 'system:oss:add' })
const editProc = proc({ permission: 'system:oss:edit' })
const delProc = proc({ permission: 'system:oss:del' })

export const sysOssRouter = router({
    create: addProc.input(SysOssAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOssService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysOssService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysOssService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysOssUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysOssService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysOssQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysOssService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysOssService(ctx).getById(input)
        }),
    page: listProc.input(SysOssPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysOssService(ctx).page(input)
        }),
    // 读取上传配置属于查询，沿用 add 权限码以保持与既有 sys_menu 授权一致
    uploadConfigs: addProc
        .query(async ({ ctx }) => {
            return sysOssService(ctx).listUploadConfigs()
        })
})
