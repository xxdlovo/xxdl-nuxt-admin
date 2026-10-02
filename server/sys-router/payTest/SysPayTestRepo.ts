/**
 * payTest 模块的 mapper。
 *
 * payTest 自己没有数据表，它读的是支付模块的渠道表与订单表，
 * 因此这里把 `Context` 适配成 `PayDb`，复用 server/pay/repo/*（同一张表只保留一份 SQL）。
 */
import type { Context } from '#server/trpc/context'
import { payChannelRepo, type PayChannelFindOptions, type PayChannelPublicRow } from '#server/pay/repo/payChannelRepo'
import { payOrderRepo, type PayOrderRow } from '#server/pay/repo/payOrderRepo'

export const sysPayTestRepo = (ctx: Context) => {
  const channels = payChannelRepo(ctx.db)
  const orders = payOrderRepo(ctx.db)

  return {
    /** 启用中的渠道公开列表（测试页下拉 / ScanPay 组件解析渠道） */
    listEnabledChannels(): Promise<PayChannelPublicRow[]> {
      return channels.listEnabledPublic()
    },

    /** 定位一个启用中的渠道行（下单前的可用性校验用） */
    findEnabledChannel(options: PayChannelFindOptions) {
      return channels.findEnabled(options)
    },

    findChannelName(channelId: string): Promise<string | null> {
      return channels.findNameById(channelId)
    },

    findOrder(orderId: string): Promise<PayOrderRow | null> {
      return orders.findById(orderId)
    }
  }
}

export type SysPayTestRepo = ReturnType<typeof sysPayTestRepo>
