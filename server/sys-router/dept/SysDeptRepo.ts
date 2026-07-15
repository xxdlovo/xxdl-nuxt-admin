import {CommonRepo} from "#server/drizzle/CommonRepo";
import { SysDeptBaseSchema } from "#shared/system/department/common";
import { sysDepartment } from "~~/server/drizzle/schema";
export const sysDeptRepo = CommonRepo(sysDepartment, SysDeptBaseSchema)
