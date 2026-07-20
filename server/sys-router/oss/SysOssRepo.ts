import { CommonRepo } from "#server/drizzle/CommonRepo";
import { SysOssBaseSchema } from "#shared/system/oss/common";
import { sysOss } from "~~/server/drizzle/schema";
import type { Context } from "#server/trpc/context";
import type { InferInsertModel } from "drizzle-orm";

const baseRepo = CommonRepo(sysOss, SysOssBaseSchema)

export const sysOssRepo = (ctx: Context) => {
    const base = baseRepo(ctx)

    return {
        ...base,
        async createUploadRecord(data: InferInsertModel<typeof sysOss>) {
            return base.create(data)
        }
    }
}
