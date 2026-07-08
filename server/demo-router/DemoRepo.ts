import {CommonRepo} from "#server/drizzle/CommonRepo";
import { DemoBaseSchema } from "#shared/demo/common";
import { demo } from "~~/server/drizzle/schema";
export const demoRepo = CommonRepo(demo, DemoBaseSchema)
