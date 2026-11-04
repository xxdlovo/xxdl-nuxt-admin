import { mysqlTable, primaryKey, unique, index, varchar, tinyint, decimal, timestamp } from "drizzle-orm/mysql-core"

export const sysGoodsLevelPrice = mysqlTable("sys_goods_level_price", {
	id: varchar({ length: 36 }).notNull(),
	goodsId: varchar("goods_id", { length: 36 }).notNull(),
	levelId: varchar("level_id", { length: 36 }).notNull(),
	price: decimal({ precision: 12, scale: 2 }).default('0.00').notNull(),
	remark: varchar({ length: 255 }),
	createdBy: varchar("created_by", { length: 36 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedBy: varchar("updated_by", { length: 36 }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().onUpdateNow().notNull(),
	isDeleted: tinyint("is_deleted").default(0),
},
(table) => [
	index("idx_goods_level_goods").on(table.goodsId, table.isDeleted),
	index("idx_goods_level_level").on(table.levelId),
	primaryKey({ columns: [table.id], name: "sys_goods_level_price_id" }),
	unique("uk_goods_level").on(table.goodsId, table.levelId),
]);
