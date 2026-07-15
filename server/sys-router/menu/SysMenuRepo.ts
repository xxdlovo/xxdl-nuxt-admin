import {CommonRepo} from "#server/drizzle/CommonRepo";
import { SysMenuBaseSchema } from "#shared/system/menu/common";
import { sysMenu } from "~~/server/drizzle/schema";
export const sysMenuRepo = CommonRepo(sysMenu, SysMenuBaseSchema)
