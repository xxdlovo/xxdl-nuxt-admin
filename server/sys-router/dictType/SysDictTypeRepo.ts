import { CommonRepo } from "#server/drizzle/CommonRepo";
import { SysDictTypeBaseSchema } from "#shared/system/dictType/common";
import { sysDictType } from "~~/server/drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import type { Context } from "#server/trpc/context";

const commonRepo = CommonRepo(sysDictType, SysDictTypeBaseSchema)

export const sysDictTypeRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    /** 按 id 取字典编码（字典数据变更后定位要失效的缓存） */
    async getCodeById(id: string) {
      const rows = await ctx.db
        .select({ code: sysDictType.code })
        .from(sysDictType)
        .where(eq(sysDictType.id, id))
        .limit(1)

      return rows[0]?.code ?? null
    },

    /** 按 id 批量取字典编码 */
    async listCodesByIds(ids: string[]) {
      if (ids.length === 0) {
        return []
      }

      const rows = await ctx.db
        .select({ code: sysDictType.code })
        .from(sysDictType)
        .where(inArray(sysDictType.id, ids))

      return rows.map(row => row.code)
    }
  }
}
