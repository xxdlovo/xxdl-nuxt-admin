import { CommonRepo } from "#server/drizzle/CommonRepo";
import { SysOauthConfigBaseSchema } from "#shared/system/oauthConfig";
import { sysOauthConfig } from "~~/server/drizzle/schema";
export const sysOauthConfigRepo = CommonRepo(sysOauthConfig, SysOauthConfigBaseSchema)
