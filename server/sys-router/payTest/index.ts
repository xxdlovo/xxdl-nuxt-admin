//#server/sys-router/payTest
import { getRequestURL } from 'h3'
import { router, proc } from '~~/server/trpc/init'
import { getRequestInfo } from '#server/utils/requestInfo'
import { SysPayTestCreateSchema, SysPayTestOrderSchema } from '#shared/system/payTest'
import { sysPayTestService } from './SysPayTestService'

/**
 * 扫码支付测试（无数据表）。
 *
 * 控制层只做三件事：声明权限、声明入参 schema、把请求信息翻译成 service 入参；
 * 渠道解析、下单、状态推进等业务全部在 SysPayTestService。
 */
const createProc = proc({ permission: 'system:payTest:create' })
const queryProc = proc({ permission: 'system:payTest:query' })
const simulateProc = proc({ permission: 'system:payTest:simulate' })
/**
 * 轮询专用的状态同步：页面每 5 秒调一次，写进 sys_system_log 只会变成噪音，
 * 因此关掉操作日志——状态真正变化时 PayOrderService 会写入支付回调日志表。
 */
const pollSyncProc = proc({ permission: 'system:payTest:query', log: false })

export const sysPayTestRouter = router({
    // 测试页渠道下拉 / ScanPay 组件解析渠道
    channels: createProc
        .query(async ({ ctx }) => {
            return await sysPayTestService(ctx).listChannels()
        }),

    // 发起扫码支付
    create: createProc.input(SysPayTestCreateSchema)
        .mutation(async ({ ctx, input }) => {
            const { ip, userAgent } = getRequestInfo(ctx.event)

            return await sysPayTestService(ctx).create(input, {
                operatorId: ctx.user?.id ?? null,
                clientIp: ip,
                userAgent,
                origin: getRequestURL(ctx.event).origin
            })
        }),

    // 订单快照（只读本地库）
    getStatus: queryProc.input(SysPayTestOrderSchema)
        .query(async ({ ctx, input }) => {
            return await sysPayTestService(ctx).getStatus(input.id)
        }),

    // 主动查询渠道并推进状态
    syncStatus: pollSyncProc.input(SysPayTestOrderSchema)
        .mutation(async ({ ctx, input }) => {
            const { ip, userAgent } = getRequestInfo(ctx.event)

            return await sysPayTestService(ctx).syncStatus(input.id, {
                operatorId: ctx.user?.id ?? null,
                clientIp: ip,
                userAgent
            })
        }),

    // 本地模拟支付成功
    simulatePaid: simulateProc.input(SysPayTestOrderSchema)
        .mutation(async ({ ctx, input }) => {
            const { ip, userAgent } = getRequestInfo(ctx.event)

            return await sysPayTestService(ctx).simulatePaid(input.id, {
                operatorId: ctx.user?.id ?? null,
                clientIp: ip,
                userAgent
            })
        })
})
