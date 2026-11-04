import { mysqlTable, primaryKey, index, varchar, tinyint, int, decimal, text, timestamp } from "drizzle-orm/mysql-core"

export const sysGoods = mysqlTable("sys_goods", {
	id: varchar({ length: 36 }).notNull(),
	name: varchar({ length: 100 }).notNull(),
	subtitle: varchar({ length: 200 }),
	cover: varchar({ length: 500 }),
	price: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	stock: int().default(0).notNull(),
	unlimitedStock: tinyint("unlimited_stock").default(0).notNull(),
	salesCount: int("sales_count").default(0).notNull(),
	type: varchar({ length: 20 }).default('virtual').notNull(),
	serviceNotice: varchar("service_notice", { length: 500 }),
	detail: text(),
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
	index("idx_goods_status").on(table.status, table.isDeleted, table.sortOrder),
	index("idx_goods_type").on(table.type, table.status),
	primaryKey({ columns: [table.id], name: "sys_goods_id" }),
]);
