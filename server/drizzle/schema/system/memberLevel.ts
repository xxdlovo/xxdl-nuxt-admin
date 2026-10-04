import { mysqlTable, primaryKey, unique, index, varchar, tinyint, int, timestamp, decimal } from "drizzle-orm/mysql-core"

export const sysMemberLevel = mysqlTable("sys_member_level", {
	id: varchar({ length: 36 }).notNull(),
	code: varchar({ length: 50 }).notNull(),
	name: varchar({ length: 50 }).notNull(),
	sortOrder: int("sort_order").default(0),
	benefit: varchar({ length: 500 }),
	price: decimal("price", { precision: 12, scale: 2 }).default('0.00').notNull(),
	durationDays: int("duration_days").default(0).notNull(),
	isDefault: tinyint("is_default").default(0).notNull(),
	isLongTerm: tinyint("is_long_term").default(0).notNull(),
	status: tinyint().default(1),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	index("idx_member_level_status").on(table.status, table.isDeleted, table.sortOrder),
	primaryKey({ columns: [table.id], name: "sys_member_level_id" }),
	unique("uk_member_level_code").on(table.code),
]);
