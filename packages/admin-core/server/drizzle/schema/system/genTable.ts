import { mysqlTable, primaryKey, unique, varchar, tinyint, timestamp } from "drizzle-orm/mysql-core"

export const sysGenTable = mysqlTable("sys_gen_table", {
	id: varchar({ length: 36 }).notNull(),
	tableName: varchar("table_name", { length: 100 }).notNull(),
	tableComment: varchar("table_comment", { length: 255 }),
	moduleName: varchar("module_name", { length: 100 }).notNull(),
	businessName: varchar("business_name", { length: 100 }).notNull(),
	author: varchar({ length: 100 }),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sys_gen_table_id" }),
	unique("uk_gen_table_name").on(table.tableName),
])
