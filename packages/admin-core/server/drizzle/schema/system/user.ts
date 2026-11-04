import { mysqlTable, primaryKey, unique, index, varchar, tinyint, timestamp } from "drizzle-orm/mysql-core"

export const sysUser = mysqlTable("sys_user", {
	id: varchar({ length: 36 }).notNull(),
	username: varchar({ length: 50 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 100 }).notNull(),
	nickname: varchar({ length: 50 }),
	avatar: varchar({ length: 255 }),
	phone: varchar({ length: 20 }),
	gender: tinyint().default(0),
	deptId: varchar("dept_id", { length: 36 }),
	isAdmin: tinyint("is_admin").default(0),
	lastLoginTime: timestamp("last_login_time", { mode: 'string' }),
	lastLoginIp: varchar("last_login_ip", { length: 50 }),
	status: tinyint().default(1),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	index("idx_user_phone").on(table.phone),
	primaryKey({ columns: [table.id], name: "sys_user_id"}),
	unique("uk_user_email").on(table.email),
	unique("uk_user_username").on(table.username),
]);
