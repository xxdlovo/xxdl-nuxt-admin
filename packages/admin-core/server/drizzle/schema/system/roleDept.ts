import { mysqlTable, primaryKey, unique, index, varchar, tinyint, timestamp } from "drizzle-orm/mysql-core"

export const sysRoleDept = mysqlTable("sys_role_dept", {
	id: varchar({ length: 36 }).notNull(),
	roleId: varchar("role_id", { length: 36 }).notNull(),
	deptId: varchar("dept_id", { length: 36 }).notNull(),
	status: tinyint().default(1),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	primaryKey({ columns: [table.id], name: "sys_role_dept_id" }),
	unique("uk_role_dept").on(table.roleId, table.deptId),
	index("idx_role_dept_dept").on(table.deptId),
])
