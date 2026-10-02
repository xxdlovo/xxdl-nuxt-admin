import { asc, eq } from 'drizzle-orm'
import { CommonRepo } from '#server/drizzle/CommonRepo'
import { sysMemberLevel } from '~~/server/drizzle/schema'
import { SysMemberLevelBaseSchema } from '#shared/system/memberLevel/common'
import type { Context } from '#server/trpc/context'

const commonRepo = CommonRepo(sysMemberLevel, SysMemberLevelBaseSchema)

export const sysMemberLevelRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    /**
     * 按等级编码取行（code 唯一性校验用）。
     * 刻意不加逻辑删除与数据范围条件：唯一索引 uk_member_level_code 只管 code，
     * 软删除的行仍然占用编码，加过滤会把重复编码漏判成可新增。
     */
    async findByCode(code: string) {
      const rows = await ctx.db
        .select()
        .from(sysMemberLevel)
        .where(eq(sysMemberLevel.code, code))
        .limit(1)

      return rows[0] ?? null
    },

    /** 等级列表排序：sortOrder 升序 → 创建时间升序 */
    levelListOrder() {
      return [asc(sysMemberLevel.sortOrder), asc(sysMemberLevel.createdAt)]
    }
  }
}
