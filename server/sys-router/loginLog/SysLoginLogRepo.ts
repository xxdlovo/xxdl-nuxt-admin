import {CommonRepo} from "#server/drizzle/CommonRepo";
import { SysLoginLogBaseSchema } from "#shared/system/loginLog/common";
import { sysLoginLog } from "~~/server/drizzle/schema";
export const sysLoginLogRepo = CommonRepo(sysLoginLog, SysLoginLogBaseSchema)
