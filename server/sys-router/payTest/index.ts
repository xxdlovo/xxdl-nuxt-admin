//#server/sys-router/payTest
import { and, asc, desc, eq } from 'drizzle-orm'
import { getRequestURL } from 'h3'
import { router, proc } from '~~/server/trpc/init'
import { sysPayChannel, sysPayOrder } from '~~/server/drizzle/schema'
import { AppError } from '#server/utils/appError'
import { getRequestInfo } from '#server/utils/requestInfo'
import type { Context } from '#server/trpc/context'
import { payNotifyDispatcher } from '#server/pay/PayNotifyDispatcher'
import { payOrderService } from '#server/pay/PayOrderService'
import { getPayProvider } from '#server/pay/providers'
import type { PayOrderRow } from '#server/pay/types'
import { SysPayTestCreateSchema, SysPayTestOrderSchema } from '#shared/system/payTest'
import type { SysPayTestStatusDTO } from '#shared/system/payTest'

// 测试页只做「发起支付 + 跟单」，权限单独授予，避免和渠道配置权限互相牵扯
const createProc = proc({ permission: 'system:payTest:create' })
const queryProc = proc({ permission: 'system:payTest:query' })
const simulateProc = proc({ permission: 'system:payTest:simulate' })
/**
 * 轮询专用的状态同步：页面每 5 秒调一次，写进 sys_system_log 只会变成噪音，
 * 因此关掉操作日志——状态真正变化时 PayOrderService 会写入支付回调日志表。
 */
const pollSyncProc = proc({ permission: 'system:payTest:query', log: false })

/** 本地模拟回调开关：生产环境默认关闭，必须显式打开 */
function isSimulateEnabled() {
    const flag = process.env.NUXT_PAY_SIMULATE_ENABLED

    if (process.env.NODE_ENV === 'production') {
        return flag === 'true'
    }

    return flag !== 'false'
}

/**
 * 定位本次下单真正要用的渠道行。
 *
 * 优先级与 PayChannelResolver 保持一致：显式 id → channelCode 过滤 → 默认渠道（isDefault 优先、sortOrder 升序）。
 * ScanPay 组件按「渠道名」解析出的 id 也会走这里，因此这条校验对所有入口生效。
 */
async function findTargetChannel(
    ctx: Context,
    channelId?: string | null,
    channelCode?: string | null
) {
    const conditions = [eq(sysPayChannel.isDeleted, 0), eq(sysPayChannel.status, 1)]

    if (channelId) {
        conditions.push(eq(sysPayChannel.id, channelId))
    }
    if (channelCode) {
        conditions.push(eq(sysPayChannel.channelCode, channelCode.trim().toLowerCase()))
    }

    const rows = await ctx.db
        .select()
        .from(sysPayChannel)
        .where(and(...conditions))
        .orderBy(desc(sysPayChannel.isDefault), asc(sysPayChannel.sortOrder), asc(sysPayChannel.createdAt))
        .limit(1)

    return rows[0] ?? null
}

/**
 * 下单前的渠道校验。
 * - 找不到渠道 → 尚未配置 / 未指定到具体渠道；
 * - verify_status !== 1 → 该渠道还没在「支付渠道配置」里点过「测试配置」并通过，
 *   此时下单大概率会失败（APPID/SECRET/网关都不确定），所以直接给出明确提示。
 */
async function assertChannelReady(ctx: Context, channelId?: string | null, channelCode?: string | null) {
    const channel = await findTargetChannel(ctx, channelId, channelCode)

    if (!channel) {
        throw new AppError('module.system.payChannel.notConfigured')
    }

    if (channel.verifyStatus !== 1) {
        throw new AppError('module.system.payChannel.notVerified', {
            message: channel.configName
        })
    }

    return channel
}

export const sysPayTestRouter = router({
    // 测试页渠道下拉 / ScanPay 组件解析渠道：只返回可公开字段，不涉及密钥
    channels: createProc
        .query(async ({ ctx }) => {
            const rows = await ctx.db
                .select({
                    id: sysPayChannel.id,
                    configName: sysPayChannel.configName,
                    channelCode: sysPayChannel.channelCode,
                    mode: sysPayChannel.mode,
                    currency: sysPayChannel.currency,
                    isDefault: sysPayChannel.isDefault,
                    verifyStatus: sysPayChannel.verifyStatus,
                    notifyUrl: sysPayChannel.notifyUrl
                })
                .from(sysPayChannel)
                .where(and(
                    eq(sysPayChannel.isDeleted, 0),
                    eq(sysPayChannel.status, 1)
                ))
                .orderBy(desc(sysPayChannel.isDefault), asc(sysPayChannel.sortOrder))

            return rows
        }),

    /**
     * 发起扫码支付。
     * bizType 留空默认 test：只有 test 订单允许「模拟支付成功」（PayNotifyDispatcher 会拒绝其他类型），
     * 因此接正式业务时请显式传入自己的 bizType（如 recharge），避免被误当成测试单。
     */
    create: createProc.input(SysPayTestCreateSchema)
        .mutation(async ({ ctx, input }) => {
            const { ip, userAgent } = getRequestInfo(ctx.event)
            const service = payOrderService(ctx.db)

            // 未配置 / 未通过「测试配置」的渠道直接拒绝，避免用错凭据下一堆失败单
            await assertChannelReady(ctx, input.channelId, input.channelCode)

            const order = await service.createPayment({
                channelId: input.channelId,
                channelCode: input.channelCode,
                outTradeNo: input.outTradeNo,
                amount: input.amount,
                subject: input.subject,
                attach: input.attach,
                remark: input.remark,
                notifyUrl: input.notifyUrl,
                bizType: input.bizType?.trim() || 'test',
                origin: getRequestURL(ctx.event).origin
            }, {
                operatorId: ctx.user?.id ?? null,
                clientIp: ip,
                userAgent
            })

            return await toStatus(ctx, order)
        }),

    // 轮询 / 手动刷新订单快照
    getStatus: queryProc.input(SysPayTestOrderSchema)
        .query(async ({ ctx, input }) => {
            return await toStatus(ctx, await getOrderOrThrow(ctx, input.id))
        }),

    // 主动查询渠道并推进状态（页面轮询与「查询状态」按钮共用）
    syncStatus: pollSyncProc.input(SysPayTestOrderSchema)
        .mutation(async ({ ctx, input }) => {
            const { ip, userAgent } = getRequestInfo(ctx.event)
            const order = await payOrderService(ctx.db).queryPayment(input.id, {
                operatorId: ctx.user?.id ?? null,
                clientIp: ip,
                userAgent
            })

            return await toStatus(ctx, order)
        }),

    // 本地模拟支付成功：走与真实回调完全相同的验签 + 幂等链路
    simulatePaid: simulateProc.input(SysPayTestOrderSchema)
        .mutation(async ({ ctx, input }) => {
            if (!isSimulateEnabled()) {
                throw new AppError('module.system.payTest.simulateDisabled')
            }

            const { ip, userAgent } = getRequestInfo(ctx.event)
            const outcome = await payNotifyDispatcher(ctx.db).simulatePaid(input.id, {
                clientIp: ip,
                userAgent
            })

            return {
                processResult: outcome.processResult,
                message: outcome.response.body,
                order: await toStatus(ctx, await getOrderOrThrow(ctx, input.id))
            }
        })
})

type TestContext = Context

/** 取订单，不存在直接抛业务错误 */
async function getOrderOrThrow(ctx: TestContext, id: string): Promise<PayOrderRow> {
    const rows = await ctx.db
        .select()
        .from(sysPayOrder)
        .where(and(eq(sysPayOrder.id, id), eq(sysPayOrder.isDeleted, 0)))
        .limit(1)

    if (!rows[0]) {
        throw new AppError('common.notExist')
    }

    return rows[0] as PayOrderRow
}

/** 订单 → 测试页快照（附带模拟能力开关，前端不自行猜测） */
async function toStatus(ctx: TestContext, order: PayOrderRow): Promise<SysPayTestStatusDTO> {
    let channelName: string | null = null

    if (order.channelId) {
        const rows = await ctx.db
            .select({ configName: sysPayChannel.configName })
            .from(sysPayChannel)
            .where(eq(sysPayChannel.id, order.channelId))
            .limit(1)

        channelName = rows[0]?.configName ?? null
    }

    const provider = getPayProvider(order.channelCode)

    return {
        id: order.id,
        outTradeNo: order.outTradeNo,
        channelId: order.channelId,
        channelCode: order.channelCode,
        channelName,
        subject: order.subject,
        amount: order.amount,
        currency: order.currency,
        status: order.status,
        providerStatus: order.providerStatus,
        payMode: order.payMode,
        qrImageUrl: order.qrImageUrl,
        qrContent: order.qrContent,
        payUrl: order.payUrl,
        notifyUrl: order.notifyUrl,
        expireAt: order.expireAt,
        paidAt: order.paidAt,
        notifyCount: order.notifyCount,
        createdAt: order.createdAt,
        simulateEnabled: isSimulateEnabled(),
        simulateSupported: Boolean(provider?.buildSimulatedNotify)
    }
}
