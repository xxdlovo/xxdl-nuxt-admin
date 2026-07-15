import {CommonRepo} from "#server/drizzle/CommonRepo";
import { SysDictTypeBaseSchema } from "#shared/system/dictType/common";
import { sysDictType } from "~~/server/drizzle/schema";
export const sysDictTypeRepo = CommonRepo(sysDictType, SysDictTypeBaseSchema)
