import { CommonRepo } from "#server/drizzle/CommonRepo";
import { SysOauthConfigBaseSchema } from "#shared/system/oauthConfig";
import { sysOauthConfig } from "~~/server/drizzle/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import type { Context } from "#server/trpc/context";

const commonRepo = CommonRepo(sysOauthConfig, SysOauthConfigBaseSchema)

export const sysOauthConfigRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    /**
     * 全部「已启用且未删除」的平台配置，按 sortOrder 升序。
     *
     * 直查而不走 CommonRepo 的通用过滤：登录流程不能被数据权限/默认条件干扰。
     */
    async listEnabled() {
      return await ctx.db
        .select()
        .from(sysOauthConfig)
        .where(and(
          eq(sysOauthConfig.status, 1),
          eq(sysOauthConfig.isDeleted, 0)
        ))
        .orderBy(asc(sysOauthConfig.sortOrder))
    },

    /**
     * 按 platform 取启用中的配置（含 clientSecret，仅服务端 OAuth 回调使用）。
     * 用 LOWER() 比对，平台列被填成 GITHUB / GitHub 时同样能命中。
     */
    async findEnabledByPlatform(platform: string) {
      const normalized = platform.trim().toLowerCase()

      if (!normalized) {
        return null
      }

      const rows = await ctx.db
        .select()
        .from(sysOauthConfig)
        .where(and(
          sql`LOWER(${sysOauthConfig.platform}) = ${normalized}`,
          eq(sysOauthConfig.status, 1),
          eq(sysOauthConfig.isDeleted, 0)
        ))
        .limit(1)

      return rows[0] ?? null
    }
  }
}
