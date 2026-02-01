import { mysqlTable, primaryKey, varchar, tinyint, timestamp, text } from "drizzle-orm/mysql-core"

export const sysSystemLog = mysqlTable("sys_system_log", {
	id: varchar({ length: 36 }).notNull(),
	level: tinyint().default(0).notNull(),
	module: varchar({ length: 50 }),
	message: text().notNull(),
	trace: text(),
	status: tinyint().default(1),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sys_system_log_id"}),
]);
