import { mysqlTable, mysqlSchema, AnyMySqlColumn, primaryKey, unique, varchar, int, tinyint, timestamp, text, index } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const sysDepartment = mysqlTable("sys_department", {
	id: varchar({ length: 36 }).notNull(),
	name: varchar({ length: 50 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	parentId: varchar("parent_id", { length: 36 }),
	path: varchar({ length: 255 }),
	level: int().default(0),
	sortOrder: int("sort_order").default(0),
	leader: varchar({ length: 50 }),
	phone: varchar({ length: 20 }),
	email: varchar({ length: 100 }),
	status: tinyint().default(1),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sys_department_id"}),
	unique("uk_dept_code").on(table.code),
]);

export const sysDictData = mysqlTable("sys_dict_data", {
	id: varchar({ length: 36 }).notNull(),
	typeId: varchar("type_id", { length: 36 }).notNull(),
	label: varchar({ length: 50 }).notNull(),
	value: varchar({ length: 100 }).notNull(),
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
	primaryKey({ columns: [table.id], name: "sys_dict_data_id"}),
]);

export const sysDictType = mysqlTable("sys_dict_type", {
	id: varchar({ length: 36 }).notNull(),
	name: varchar({ length: 50 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	status: tinyint().default(1),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sys_dict_type_id"}),
	unique("uk_dict_code").on(table.code),
]);

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

export const sysRoleMenu = mysqlTable("sys_role_menu", {
	id: varchar({ length: 36 }).notNull(),
	roleId: varchar("role_id", { length: 36 }).notNull(),
	menuId: varchar("menu_id", { length: 36 }).notNull(),
	status: tinyint().default(1),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sys_role_menu_id"}),
	unique("uk_role_menu").on(table.roleId, table.menuId),
]);

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

export const sysUserRole = mysqlTable("sys_user_role", {
	id: varchar({ length: 36 }).notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	roleId: varchar("role_id", { length: 36 }).notNull(),
	status: tinyint().default(1),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sys_user_role_id"}),
	unique("uk_user_role").on(table.userId, table.roleId),
]);
