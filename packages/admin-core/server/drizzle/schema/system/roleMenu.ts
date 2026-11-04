import { mysqlTable, primaryKey, unique, varchar, tinyint, timestamp } from "drizzle-orm/mysql-core"

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
