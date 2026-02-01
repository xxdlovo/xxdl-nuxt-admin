import { mysqlTable, primaryKey, unique, varchar, tinyint, int, timestamp } from "drizzle-orm/mysql-core"

export const sysMenu = mysqlTable("sys_menu", {
	id: varchar({ length: 36 }).notNull(),
	parentId: varchar("parent_id", { length: 36 }),
	name: varchar({ length: 50 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	type: tinyint().notNull(),
	path: varchar({ length: 255 }),
	component: varchar({ length: 255 }),
	icon: varchar({ length: 50 }),
	sortOrder: int("sort_order").default(0),
	visible: tinyint().default(1),
	status: tinyint().default(1),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sys_menu_id"}),
	unique("uk_menu_code").on(table.code),
]);
