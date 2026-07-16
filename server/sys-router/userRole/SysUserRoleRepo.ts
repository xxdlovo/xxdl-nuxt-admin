import {CommonRepo} from "#server/drizzle/CommonRepo";
import { SysUserRoleBaseSchema } from "#shared/system/userRole/common";
import { sysUserRole } from "~~/server/drizzle/schema";
export const sysUserRoleRepo = CommonRepo(sysUserRole, SysUserRoleBaseSchema)
