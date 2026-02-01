import { mysqlTable, primaryKey, varchar, tinyint, timestamp } from "drizzle-orm/mysql-core"

export const sysLoginLog = mysqlTable("sys_login_log", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }),
	username: varchar({ length: 50 }).notNull(),
	ip: varchar({ length: 50 }).notNull(),
	location: varchar({ length: 100 }),
	browser: varchar({ length: 50 }),
	os: varchar({ length: 50 }),
	userAgent: varchar("user_agent", { length: 500 }),
	loginTime: timestamp("login_time", { mode: 'string' }).defaultNow().notNull(),
	status: tinyint().notNull(),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sys_login_log_id"}),
]);
