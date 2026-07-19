import { CommonRepo } from '#server/drizzle/CommonRepo'
import { SysRoleBaseSchema } from "#shared/system/role/common";
import { sysRole } from "~~/server/drizzle/schema";
import type { Context } from '#server/trpc/context'
import { and, eq, inArray } from 'drizzle-orm'

const commonRepo = CommonRepo(sysRole, SysRoleBaseSchema)

export const sysRoleRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    /**
     * Load only the roles referenced by the current assignment request.
     */
    async listByIds(ids: string[]) {
      if (ids.length === 0) {
        return []
      }

      return await ctx.db
        .select()
        .from(sysRole)
        .where(and(
          eq(sysRole.isDeleted, 0),
          inArray(sysRole.id, ids)
        ))
    }
  }
}
