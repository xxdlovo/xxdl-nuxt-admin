import { and, asc, desc, eq, ne } from 'drizzle-orm'
import { CommonRepo } from '#server/drizzle/CommonRepo'
import { sysPayChannel } from '~~/server/drizzle/schema'
import { SysPayChannelBaseSchema } from '#shared/system/payChannel/common'
import type { Context } from '#server/trpc/context'

const commonRepo = CommonRepo(sysPayChannel, SysPayChannelBaseSchema)

export const sysPayChannelRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    /** 按渠道类型取启用中的配置（测试页的渠道下拉用） */
    async listEnabledByCode(channelCode?: string | null) {
      const conditions = [eq(sysPayChannel.isDeleted, 0), eq(sysPayChannel.status, 1)]

      if (channelCode) {
        conditions.push(eq(sysPayChannel.channelCode, channelCode.trim().toLowerCase()))
      }

      return await ctx.db
        .select()
        .from(sysPayChannel)
        .where(and(...conditions))
    },

    /** 设为默认渠道前，先把其他渠道的默认标记清掉，保证全局只有一个默认 */
    async clearOtherDefaults(excludeId: string) {
      return await ctx.db
        .update(sysPayChannel)
        .set({ isDefault: 0, updatedBy: ctx.user?.id ?? null })
        .where(and(
          eq(sysPayChannel.isDeleted, 0),
          ne(sysPayChannel.id, excludeId)
        ))
    },

    /** 渠道列表排序：默认渠道优先 → sortOrder 升序 → 创建时间倒序 */
    channelListOrder() {
      return [desc(sysPayChannel.isDefault), asc(sysPayChannel.sortOrder), desc(sysPayChannel.createdAt)]
    }
  }
}
