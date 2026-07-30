import { CommonRepo } from '#server/drizzle/CommonRepo'
import type { Context } from '#server/trpc/context'
import { sysConfig } from '#server/drizzle/schema'
import { SysConfigBaseSchema } from '#shared/system/config/common'
import { and, eq } from 'drizzle-orm'

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
    }
  }
}
