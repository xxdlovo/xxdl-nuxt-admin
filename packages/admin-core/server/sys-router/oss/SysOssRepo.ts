import { desc } from "drizzle-orm";
import { CommonRepo } from "#admin/server/drizzle/CommonRepo";
import { SysOssBaseSchema } from "#admin/shared/system/oss/common";
import { sysOss } from "#admin/server/drizzle/schema";
import type { Context } from "#admin/server/trpc/context";
import type { InferInsertModel } from "drizzle-orm";

const baseRepo = CommonRepo(sysOss, SysOssBaseSchema)

export const sysOssRepo = (ctx: Context) => {
    const base = baseRepo(ctx)

    return {
        ...base,
        async createUploadRecord(data: InferInsertModel<typeof sysOss>) {
            return base.create(data)
        },

        /** 分页查询（创建时间倒序）：排序语义集中在 mapper */
        async pageRecent(page: number, pageSize: number, dto: Record<string, unknown>) {
            return base.page(page, pageSize, dto, [desc(sysOss.createdAt)])
        },

        /** 列表查询（创建时间倒序） */
        async listRecent(dto: Record<string, unknown>) {
            return base.list(dto, [desc(sysOss.createdAt)])
        }
    }
}
