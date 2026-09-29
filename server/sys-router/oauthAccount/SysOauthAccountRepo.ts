import { CommonRepo } from "#server/drizzle/CommonRepo"
import type { Context } from "#server/trpc/context"
import { SysOauthAccountBaseSchema } from "#shared/system/oauthAccount"
import { and, eq, inArray } from "drizzle-orm"
import { sysOauthAccount } from "~~/server/drizzle/schema"

const commonRepo = CommonRepo(sysOauthAccount, SysOauthAccountBaseSchema)

export const sysOauthAccountRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    /**
     * 按 (provider, providerUserId) 查绑定记录，**包含已软删的行**。
     *
     * uk_oauth_provider_user 是 (provider, provider_user_id) 唯一索引，不含
     * is_deleted，所以被软删的行依旧占用唯一键。登录时必须能查到这类残留行，
     * 否则直接 insert 会撞唯一键报错。
     */
    async getByProviderUserIdIncludingDeleted(provider: string, providerUserId: string) {
      const rows = await ctx.db
        .select()
        .from(sysOauthAccount)
        .where(and(
          eq(sysOauthAccount.provider, provider),
          eq(sysOauthAccount.providerUserId, providerUserId)
        ))
        .limit(1)

      return rows[0] ?? null
    },

    /**
     * 复用一条已存在的绑定行：把 is_deleted 复位为 0 并刷新平台侧资料。
     * 用于「删除后同一第三方账号再次登录」的场景，避免插入撞唯一键。
     */
    async reviveBinding(id: string, data: {
      userId: string
      providerLogin?: string | null
      avatar?: string | null
      rawProfile?: string | null
      updatedBy?: string | null
    }) {
      await ctx.db
        .update(sysOauthAccount)
        .set({
          isDeleted: 0,
          userId: data.userId,
          providerLogin: data.providerLogin ?? null,
          avatar: data.avatar ?? null,
          rawProfile: data.rawProfile ?? null,
          updatedBy: data.updatedBy ?? null
        })
        .where(eq(sysOauthAccount.id, id))
    },

    /** 建立一条第三方账号绑定。 */
    async createBinding(data: {
      id: string
      userId: string
      provider: string
      providerUserId: string
      providerLogin?: string | null
      avatar?: string | null
      rawProfile?: string | null
      createdBy?: string | null
      updatedBy?: string | null
    }) {
      await ctx.db.insert(sysOauthAccount).values({
        ...data,
        isDeleted: 0
      })
    },

    /**
     * 物理删除绑定行。
     *
     * 不能复用 CommonRepo.remove（它只把 is_deleted 置 1）：唯一索引
     * (provider, provider_user_id) 不包含 is_deleted，软删后该行仍占用唯一键，
     * 同一第三方账号再次登录时会插入失败。解绑语义上就是释放这个占位，
     * 因此这里做硬删除；该表是绑定关系表，不存在需要保留的审计诉求。
     */
    async hardDeleteById(id: string) {
      await ctx.db.delete(sysOauthAccount).where(eq(sysOauthAccount.id, id))
    },

    /** 批量物理删除。 */
    async hardDeleteByIds(ids: string[]) {
      if (ids.length === 0) return 0
      await ctx.db.delete(sysOauthAccount).where(inArray(sysOauthAccount.id, ids))
      return ids.length
    }
  }
}
