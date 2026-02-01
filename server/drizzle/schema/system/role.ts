import { mysqlTable, primaryKey, unique, varchar, tinyint, int, timestamp, text } from "drizzle-orm/mysql-core"

export const sysRole = mysqlTable("sys_role", {
	id: varchar({ length: 36 }).notNull(),
	name: varchar({ length: 50 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	description: text(),
	isSystem: tinyint("is_system").default(0),
	sortOrder: int("sort_order").default(0),
	status: tinyint().default(1),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sys_role_id"}),
	unique("uk_role_code").on(table.code),
]);
