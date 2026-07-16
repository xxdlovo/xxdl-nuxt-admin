import { CommonRepo } from "#server/drizzle/CommonRepo";
import { SysLogBaseSchema } from "#shared/system/SysLog/common";
import { sysSystemLog } from "~~/server/drizzle/schema";
export const sysSystemLogRepo = CommonRepo(sysSystemLog, SysLogBaseSchema)
