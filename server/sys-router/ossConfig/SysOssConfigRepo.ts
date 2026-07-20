import { CommonRepo } from "#server/drizzle/CommonRepo";
import { SysOssConfigBaseSchema } from "#shared/system/ossConfig/common";
import { sysOssConfig } from "~~/server/drizzle/schema";

export const sysOssConfigRepo = CommonRepo(sysOssConfig, SysOssConfigBaseSchema)
