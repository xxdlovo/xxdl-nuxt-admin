//#server/trade-router/modules/memberFreeze
import { router, proc } from '~~/server/trpc/init'
import { sysMemberFreezeService } from './SysMemberFreezeService'
import z from 'zod'
import {
    SysMemberFreezeUpdateSchema,
    SysMemberFreezeReleaseSchema,
    SysMemberFreezeQuerySchema,
    SysMemberFreezePageQuerySchema
} from '#shared/system/memberFreeze'

const listProc = proc({ permission: 'system:memberFreeze:list' })
// 冻结单由领域层在业务事务内写入，管理端不提供补单入口，因此没有 add 权限码
const editProc = proc({ permission: 'system:memberFreeze:edit' })
const delProc = proc({ permission: 'system:memberFreeze:del' })
// 释放会把预扣余额退回用户，属资金动作，单独授权便于只读角色排除
const releaseProc = proc({ permission: 'system:memberFreeze:release' })

export const sysMemberFreezeRouter = router({
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysMemberFreezeService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysMemberFreezeService(ctx).batchRemove(input)
        }),
    // 只允许改备注，其他字段由 Service 忽略
    update: editProc.input(SysMemberFreezeUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberFreezeService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysMemberFreezeQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberFreezeService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysMemberFreezeService(ctx).getById(input)
        }),
    page: listProc.input(SysMemberFreezePageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysMemberFreezeService(ctx).page(input)
        }),
    // 人工释放冻结（业务失败或人工介入），reason 由 Schema 保证必填
    release: releaseProc.input(SysMemberFreezeReleaseSchema)
        .mutation(async ({ ctx, input }) => {
            return sysMemberFreezeService(ctx).release(input)
        })
})
