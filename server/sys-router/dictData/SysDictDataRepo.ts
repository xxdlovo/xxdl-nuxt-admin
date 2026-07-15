import {CommonRepo} from "#server/drizzle/CommonRepo";
import { SysDictDataBaseSchema } from "#shared/system/dictData/common";
import { sysDictData } from "~~/server/drizzle/schema";
export const sysDictDataRepo = CommonRepo(sysDictData, SysDictDataBaseSchema)
