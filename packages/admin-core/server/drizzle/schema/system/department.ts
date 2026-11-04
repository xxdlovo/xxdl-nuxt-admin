import { mysqlTable, primaryKey, unique, varchar, int, tinyint, timestamp } from "drizzle-orm/mysql-core"

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
