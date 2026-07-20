import { CommonRepo } from "#server/drizzle/CommonRepo";
import { SysOssBaseSchema } from "#shared/system/oss/common";
import { sysOss } from "~~/server/drizzle/schema";

export const sysOssRepo = CommonRepo(sysOss, SysOssBaseSchema)
