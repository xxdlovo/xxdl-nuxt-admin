/**
 * 统一支付回调入口：POST /api/pay/notify/{channel}
 *
 * - {channel} 是渠道平台标识（xunhupay / mock / 未来扩展的 codepay、stripe、alipay_f2f）；
 * - 必须免登录（平台无法携带会话），因此这里不走 tRPC，鉴权完全依赖渠道验签；
 * - 必须先读原始报文再解析：Stripe 等平台验签依赖原文，虎皮椒/码支付读表单；
 * - 响应体由适配器决定（虎皮椒要求纯文本 success）。
 */
import {
    defineEventHandler,
    getHeader,
    getRequestHeaders,
    getRouterParam,
    readRawBody,
    setResponseHeader,
    setResponseStatus
} from 'h3'
import { useDb } from '#server/drizzle/db'
import { payNotifyDispatcher } from '#server/trade-router/domain/pay/PayNotifyDispatcher'
import { dispatchPaidOrder } from '#server/trade-router/domain/pay/PaidHandlers'
import { getRequestInfo } from '#server/utils/requestInfo'

/** 原始报文 → 对象：JSON 走 JSON.parse，其余按表单解析 */
function parseNotifyBody(rawBody: string, contentType: string): Record<string, unknown> {
    const raw = rawBody?.trim() ?? ''

    if (!raw) {
        return {}
    }

    const type = (contentType || '').toLowerCase()

    if (type.includes('application/json') || raw.startsWith('{')) {
        try {
            const parsed = JSON.parse(raw)
            return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
        } catch {
            return {}
        }
    }

    const result: Record<string, unknown> = {}
    for (const [key, value] of new URLSearchParams(raw)) {
        result[key] = value
    }

    return result
}

export default defineEventHandler(async (event) => {
    const channelCode = getRouterParam(event, 'channel') ?? ''
    const contentType = getHeader(event, 'content-type') ?? ''
    const rawBody = await readRawBody(event, 'utf8') ?? ''

    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(getRequestHeaders(event))) {
        headers[key.toLowerCase()] = Array.isArray(value) ? value.join(',') : String(value ?? '')
    }

    const { ip, userAgent } = getRequestInfo(event)

    /**
     * 支付成功后的业务后置处理：统一交给 `dispatchPaidOrder` 按 `bizType` 分派
     * （recharge → 会员充值到账；order → 交易订单完成；其它类型保持原 no-op）。
     */
    const outcome = await payNotifyDispatcher(useDb(), {
        onPaid: async (order) => {
            await dispatchPaidOrder(order, useDb())
        }
    }).handleNotify(
        channelCode,
        { headers, rawBody, body: parseNotifyBody(rawBody, contentType) },
        { clientIp: ip, userAgent, source: 'notify' }
    )

    setResponseStatus(event, outcome.response.statusCode)
    setResponseHeader(event, 'content-type', outcome.response.contentType)

    return outcome.response.body
})
