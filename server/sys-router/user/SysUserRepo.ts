import { CommonRepo } from "#server/drizzle/CommonRepo"
import type { Context } from "#server/trpc/context"
import { SysUserBaseSchema } from "#shared/system/user/common"
import { eq } from "drizzle-orm"
import { sysUser } from "~~/server/drizzle/schema"

const commonRepo = CommonRepo(sysUser, SysUserBaseSchema)

export const sysUserRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    async updatePasswordById(id: string, password: string) {
      await ctx.db
        .update(sysUser)
        .set({ password })
        .where(eq(sysUser.id, id))
    }
  }
}
