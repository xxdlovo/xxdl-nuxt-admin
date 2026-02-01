import {CommonRepo} from "#server/drizzle/CommonRepo";
import { SysUserBaseSchema } from "#shared/system/user/common";
import { sysUser } from "~~/server/drizzle/schema";
export const sysUserRepo = CommonRepo(sysUser, SysUserBaseSchema)