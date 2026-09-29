import { CommonRepo } from "#server/drizzle/CommonRepo";
import { SysOauthAccountBaseSchema } from "#shared/system/oauthAccount";
import { sysOauthAccount } from "~~/server/drizzle/schema";
export const sysOauthAccountRepo = CommonRepo(sysOauthAccount, SysOauthAccountBaseSchema)
