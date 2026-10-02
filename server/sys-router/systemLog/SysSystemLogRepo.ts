import { CommonRepo } from "#server/drizzle/CommonRepo";
import { SysLogBaseSchema } from "#shared/system/SysLog/common";
import { sysSystemLog } from "~~/server/drizzle/schema";
import { desc } from "drizzle-orm";
import type { Context } from "#server/trpc/context";

const commonRepo = CommonRepo(sysSystemLog, SysLogBaseSchema)

export const sysSystemLogRepo = (ctx: Context) => {
  const repo = commonRepo(ctx)

  return {
    ...repo,

    /** 分页查询（记录时间倒序）：排序语义集中在 mapper */
    async pageRecent(page: number, pageSize: number, dto: Record<string, unknown>) {
      return await repo.page(page, pageSize, dto, [desc(sysSystemLog.createdAt)])
    },

    /** 列表查询（记录时间倒序） */
    async listRecent(dto: Record<string, unknown>) {
      return await repo.list(dto, [desc(sysSystemLog.createdAt)])
    }
  }
}
