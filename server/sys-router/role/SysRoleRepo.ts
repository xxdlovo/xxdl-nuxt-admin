import {CommonRepo} from "#server/drizzle/CommonRepo";
import { SysRoleBaseSchema } from "#shared/system/role/common";
import { sysRole } from "~~/server/drizzle/schema";
export const sysRoleRepo = CommonRepo(sysRole, SysRoleBaseSchema)
