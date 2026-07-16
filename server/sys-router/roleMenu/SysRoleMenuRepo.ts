import {CommonRepo} from "#server/drizzle/CommonRepo";
import { SysRoleMenuBaseSchema } from "#shared/system/roleMenu/common";
import { sysRoleMenu } from "~~/server/drizzle/schema";
export const sysRoleMenuRepo = CommonRepo(sysRoleMenu, SysRoleMenuBaseSchema)
