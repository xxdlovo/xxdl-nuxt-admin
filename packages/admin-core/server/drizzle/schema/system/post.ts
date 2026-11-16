import { mysqlTable, primaryKey, unique, varchar, tinyint, int, timestamp } from "drizzle-orm/mysql-core"

export const sysPost = mysqlTable("sys_post", {
	id: varchar({ length: 36 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	name: varchar({ length: 50 }).notNull(),
	sortOrder: int("sort_order").default(0),
	status: tinyint().default(1),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sys_post_id" }),
	unique("uk_post_code").on(table.code),
])
