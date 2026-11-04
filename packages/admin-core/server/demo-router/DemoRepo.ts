import {CommonRepo} from "#admin/server/drizzle/CommonRepo";
import { DemoBaseSchema } from "#admin/shared/demo/common";
import { demo } from "#admin/server/drizzle/schema";
export const demoRepo = CommonRepo(demo, DemoBaseSchema)
