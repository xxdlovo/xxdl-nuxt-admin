import { CommonRepo } from '#admin/server/drizzle/CommonRepo'
import type { Context } from '#admin/server/trpc/context'
import { sysConfig } from '#admin/server/drizzle/schema'
import { SysConfigBaseSchema } from '#admin/shared/system/config/common'
import { and, eq, inArray } from 'drizzle-orm'

const baseRepo = CommonRepo(sysConfig, SysConfigBaseSchema)

export const sysConfigRepo = (ctx: Context) => {
  const base = baseRepo(ctx)

  return {
    ...base,
    async getByKey(key: string) {
      const rows = await ctx.db
        .select()
        .from(sysConfig)
        .where(and(
          eq(sysConfig.configKey, key),
          eq(sysConfig.isDeleted, 0)
        ))
        .limit(1)

      return rows[0] ?? null
    },
    /** 批量按 key 读取：限流等中间件一次取多个配置项时避免多次往返。 */
    async getByKeys(keys: string[]) {
      if (keys.length === 0) {
        return []
      }

      return ctx.db
        .select()
        .from(sysConfig)
        .where(and(
          inArray(sysConfig.configKey, keys),
          eq(sysConfig.isDeleted, 0)
        ))
    }
  }
}
