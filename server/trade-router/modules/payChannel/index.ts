//#server/trade-router/modules/payChannel
import { router, proc } from '~~/server/trpc/init'
import { sysPayChannelService } from './SysPayChannelService'
import z from 'zod'
import {
    SysPayChannelAddSchema,
    SysPayChannelUpdateSchema,
    SysPayChannelQuerySchema,
    SysPayChannelPageQuerySchema
} from '#shared/system/payChannel'

const listProc = proc({ permission: 'system:payChannel:list' })
const addProc = proc({ permission: 'system:payChannel:add' })
const editProc = proc({ permission: 'system:payChannel:edit' })
const delProc = proc({ permission: 'system:payChannel:del' })
// 验证与设为默认都属于配置维护动作，单独授权便于只读角色排除
const verifyProc = proc({ permission: 'system:payChannel:verify' })
const defaultProc = proc({ permission: 'system:payChannel:default' })

export const sysPayChannelRouter = router({
    create: addProc.input(SysPayChannelAddSchema)
        .mutation(async ({ ctx, input }) => {
            return sysPayChannelService(ctx).create(input)
        }),
    remove: delProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysPayChannelService(ctx).remove(input)
        }),
    batchDelete: delProc.input(z.array(z.string()))
        .mutation(async ({ ctx, input }) => {
            return sysPayChannelService(ctx).batchRemove(input)
        }),
    update: editProc.input(SysPayChannelUpdateSchema)
        .mutation(async ({ ctx, input }) => {
            return sysPayChannelService(ctx).updateById(input.id, input)
        }),
    getOne: listProc.input(SysPayChannelQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysPayChannelService(ctx).getOne(input)
        }),
    getById: listProc.input(z.string())
        .query(async ({ ctx, input }) => {
            return sysPayChannelService(ctx).getById(input)
        }),
    page: listProc.input(SysPayChannelPageQuerySchema)
        .query(async ({ ctx, input }) => {
            return sysPayChannelService(ctx).page(input)
        }),
    // 「测试配置」：调用渠道适配器探测网关与签名
    verify: verifyProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysPayChannelService(ctx).verify(input)
        }),
    // 设为默认渠道（全局唯一）
    setDefault: defaultProc.input(z.string())
        .mutation(async ({ ctx, input }) => {
            return sysPayChannelService(ctx).setDefault(input)
        }),
    // 渠道类型元数据：驱动前端渠道类型下拉与动态表单
    providerMetas: listProc
        .query(async ({ ctx }) => {
            return sysPayChannelService(ctx).providerMetas()
        })
})
