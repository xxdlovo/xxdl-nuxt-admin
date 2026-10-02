/**
 * 扫码支付测试模块的 Service：渠道可用性校验、统一下单、状态查询、模拟回调。
 *
 * 分层约定：
 * - 取数写数走 SysPayTestRepo → server/trade-router/domain/pay/repo/*（mapper 层）；
 * - 真正的支付实现走 server/trade-router/domain/pay（领域层），本文件只做「测试场景的业务编排」；
 * - 控制层（index.ts）只负责权限、入参 schema 与调用这里的方法。
 */
import { AppError } from '#server/utils/appError'
import { payNotifyDispatcher } from '#server/trade-router/domain/pay/PayNotifyDispatcher'
import { payOrderService, type PayOperatorMeta } from '#server/trade-router/domain/pay/PayOrderService'
import { getPayProvider } from '#server/trade-router/domain/pay/providers'
import type { PayOrderRow } from '#server/trade-router/domain/pay/types'
import type { Context } from '#server/trpc/context'
import type { SysPayTestCreateDTO, SysPayTestStatusDTO } from '#shared/system/payTest'
import { sysPayTestRepo } from './SysPayTestRepo'

/** 本地模拟回调开关：生产环境默认关闭，必须显式打开 */
export function isSimulateEnabled() {
    const flag = process.env.NUXT_PAY_SIMULATE_ENABLED

    if (process.env.NODE_ENV === 'production') {
        return flag === 'true'
    }

    return flag !== 'false'
}

/**
 * 下单前的渠道校验：
 * - 找不到渠道 → 尚未配置 / 未指定到具体渠道；
 * - verify_status !== 1 → 该渠道还没在「支付渠道配置」里点过「测试配置」并通过，
 *   此时下单大概率会失败（APPID/SECRET/网关都不确定），因此直接给出明确提示。
 */
export function sysPayTestService(ctx: Context) {
    const repo = sysPayTestRepo(ctx)
    const orders = payOrderService(ctx.db)
    const dispatcher = payNotifyDispatcher(ctx.db)

    async function assertChannelReady(channelId?: string | null, channelCode?: string | null) {
        const channel = await repo.findEnabledChannel({ channelId, channelCode })

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

    /** 订单 → 测试页快照（附带模拟能力开关，前端不自行猜测） */
    async function toStatus(order: PayOrderRow): Promise<SysPayTestStatusDTO> {
        const channelName = order.channelId ? await repo.findChannelName(order.channelId) : null
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

    async function getOrderOrThrow(orderId: string): Promise<PayOrderRow> {
        const order = await repo.findOrder(orderId)

        if (!order) {
            throw new AppError('common.notExist')
        }

        return order
    }

    return {
        /** 渠道下拉 / ScanPay 组件解析渠道：只暴露可公开字段 */
        async listChannels() {
            return await repo.listEnabledChannels()
        },

        /** 发起扫码支付（bizType 留空默认 test，只有 test 订单允许被模拟支付） */
        async create(input: SysPayTestCreateDTO, meta: PayOperatorMeta & { origin?: string | null }) {
            await assertChannelReady(input.channelId, input.channelCode)

            const order = await orders.createPayment({
                channelId: input.channelId,
                channelCode: input.channelCode,
                outTradeNo: input.outTradeNo,
                amount: input.amount,
                subject: input.subject,
                attach: input.attach,
                remark: input.remark,
                notifyUrl: input.notifyUrl,
                bizType: input.bizType?.trim() || 'test',
                origin: meta.origin
            }, meta)

            return await toStatus(order)
        },

        /** 订单快照（只读本地库） */
        async getStatus(orderId: string) {
            return await toStatus(await getOrderOrThrow(orderId))
        },

        /** 主动查询渠道并推进状态（页面轮询与「查询状态」按钮共用） */
        async syncStatus(orderId: string, meta: PayOperatorMeta = {}) {
            return await toStatus(await orders.queryPayment(orderId, meta))
        },

        /** 本地模拟支付成功：走与真实回调完全相同的验签 + 幂等链路 */
        async simulatePaid(orderId: string, meta: PayOperatorMeta = {}) {
            if (!isSimulateEnabled()) {
                throw new AppError('module.system.payTest.simulateDisabled')
            }

            const outcome = await dispatcher.simulatePaid(orderId, meta)

            return {
                processResult: outcome.processResult,
                message: outcome.response.body,
                order: await toStatus(await getOrderOrThrow(orderId))
            }
        }
    }
}

export type SysPayTestService = ReturnType<typeof sysPayTestService>
