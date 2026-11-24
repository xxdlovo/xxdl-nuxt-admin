//#trade/server/trade-router/modules/payChannel
import { router, proc, publicProcedure } from '#admin/server/trpc/init'
import { rateLimitMiddleware } from '#admin/server/trpc/middlewares/rateLimit'
import { sysPayChannelService } from './SysPayChannelService'
import z from 'zod'
import {
    SysPayChannelAddSchema,
    SysPayChannelUpdateSchema,
    SysPayChannelQuerySchema,
    SysPayChannelPageQuerySchema
} from '#trade/shared/system/payChannel'

const listProc = proc({ permission: 'system:payChannel:list' })
const addProc = proc({ permission: 'system:payChannel:add' })
const editProc = proc({ permission: 'system:payChannel:edit' })
const delProc = proc({ permission: 'system:payChannel:del' })
// 验证与设为默认都属于配置维护动作，单独授权便于只读角色排除
const verifyProc = proc({ permission: 'system:payChannel:verify' })
const defaultProc = proc({ permission: 'system:payChannel:default' })

// 公开支付方式查询：匿名可访问，按 IP 限流（60 次/分钟）。
const publicPayLimit = rateLimitMiddleware({ limit: 60, windowMs: 60_000, scope: 'public-pay-channel' })

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
        }),
    /**
     * 公开支付方式列表（游客，无需登录）。
     * 只返回「已启用 + 已验证」的渠道，字段白名单不含任何密钥/回调地址。
     * 匿名可访问，按 IP 限流（60 次/分钟）。
     */
    publicList: publicProcedure.use(publicPayLimit)
        .query(async ({ ctx }) => {
            return sysPayChannelService(ctx).publicList()
        })
})
