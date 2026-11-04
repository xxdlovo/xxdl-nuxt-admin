import { CommonRepo } from "#admin/server/drizzle/CommonRepo";
import { SysLoginLogBaseSchema } from "#admin/shared/system/loginLog/common";
import { sysLoginLog } from "#admin/server/drizzle/schema";
import { desc } from "drizzle-orm";
import type { Context } from "#admin/server/trpc/context";

const commonRepo = CommonRepo(sysLoginLog, SysLoginLogBaseSchema)

export const sysLoginLogRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    /** 分页查询（登录时间倒序）：排序语义集中在 mapper */
    async pageRecent(page: number, pageSize: number, dto: Record<string, unknown>) {
      return await repo.page(page, pageSize, dto, [desc(sysLoginLog.createdAt)])
    },

    /** 列表查询（登录时间倒序） */
    async listRecent(dto: Record<string, unknown>) {
      return await repo.list(dto, [desc(sysLoginLog.createdAt)])
    }
  }
}
